"""
Video Calling WebRTC Signaling Server
This module handles WebRTC signaling for video calls between peers.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional
import json
import logging
import os
import asyncio
import uuid
from datetime import datetime
from contextlib import asynccontextmanager

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Video calling server starting up...")
    logger.info(f"Static files directory: {os.path.abspath('static')}")
    yield
    # Shutdown
    logger.info("Video calling server shutting down...")

# Create FastAPI app
app = FastAPI(
    title="Video Calling App",
    description="Professional WebRTC Video Calling Application",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    """Enhanced connection manager with better tracking and error handling"""
    
    def __init__(self):
        self.connections: Dict[str, WebSocket] = {}
        self.user_rooms: Dict[str, str] = {}  # user_id -> room_id
        self.room_users: Dict[str, List[str]] = {}  # room_id -> [user_ids]
        self.user_info: Dict[str, Dict] = {}  # user_id -> {websocket, joined_at, etc}
    
    def generate_user_id(self) -> str:
        """Generate unique user ID"""
        return str(uuid.uuid4())
    
    async def connect_user(self, websocket: WebSocket, room_id: str) -> str:
        """Connect a user to a room and return user ID"""
        await websocket.accept()
        
        user_id = self.generate_user_id()
        
        # Store user information
        self.connections[user_id] = websocket
        self.user_rooms[user_id] = room_id
        self.user_info[user_id] = {
            'websocket': websocket,
            'room_id': room_id,
            'joined_at': datetime.now(),
            'is_connected': True
        }
        
        # Add user to room
        if room_id not in self.room_users:
            self.room_users[room_id] = []
        self.room_users[room_id].append(user_id)
        
        logger.info(f"User {user_id} joined room {room_id}. Total users in room: {len(self.room_users[room_id])}")
        
        # Notify other users in the room about new user
        await self.broadcast_to_room(room_id, {
            "type": "user-joined",
            "user_id": user_id,
            "message": "A new user joined the call",
            "room_size": len(self.room_users[room_id])
        }, exclude_user=user_id)
        
        # Send current room info to the new user
        await self.send_to_user(user_id, {
            "type": "room-info",
            "room_id": room_id,
            "user_id": user_id,
            "room_size": len(self.room_users[room_id]),
            "is_initiator": len(self.room_users[room_id]) == 1
        })
        
        return user_id
    
    async def disconnect_user(self, user_id: str):
        """Disconnect a user and clean up"""
        if user_id not in self.user_info:
            return
        
        user_info = self.user_info[user_id]
        room_id = user_info['room_id']
        
        # Remove user from room
        if room_id in self.room_users and user_id in self.room_users[room_id]:
            self.room_users[room_id].remove(user_id)
            
            # Clean up empty rooms
            if not self.room_users[room_id]:
                del self.room_users[room_id]
                logger.info(f"Room {room_id} is now empty and has been removed")
            else:
                # Notify remaining users
                await self.broadcast_to_room(room_id, {
                    "type": "user-left",
                    "user_id": user_id,
                    "message": "A user left the call",
                    "room_size": len(self.room_users[room_id])
                })
        
        # Clean up user data
        self.connections.pop(user_id, None)
        self.user_rooms.pop(user_id, None)
        self.user_info.pop(user_id, None)
        
        logger.info(f"User {user_id} disconnected from room {room_id}")
    
    async def handle_message(self, user_id: str, message: dict):
        """Handle incoming messages from users"""
        if user_id not in self.user_info:
            logger.warning(f"Received message from unknown user {user_id}")
            return
        
        room_id = self.user_info[user_id]['room_id']
        message_type = message.get('type', 'unknown')
        
        logger.info(f"Handling {message_type} message from user {user_id} in room {room_id}")
        
        # Add sender information to message
        message['sender_id'] = user_id
        message['timestamp'] = datetime.now().isoformat()
        
        # Broadcast message to other users in the room
        await self.broadcast_to_room(room_id, message, exclude_user=user_id)
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send message to a specific user"""
        if user_id in self.connections:
            try:
                websocket = self.connections[user_id]
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")
                await self.disconnect_user(user_id)
    
    async def broadcast_to_room(self, room_id: str, message: dict, exclude_user: Optional[str] = None):
        """Send message to all users in a room except the sender"""
        if room_id not in self.room_users:
            return
        
        disconnected_users = []
        
        for user_id in self.room_users[room_id]:
            if user_id != exclude_user and user_id in self.connections:
                try:
                    websocket = self.connections[user_id]
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to user {user_id}: {e}")
                    disconnected_users.append(user_id)
        
        # Clean up disconnected users
        for user_id in disconnected_users:
            await self.disconnect_user(user_id)
    
    def get_room_info(self, room_id: str) -> Dict:
        """Get information about a room"""
        if room_id not in self.room_users:
            return {"exists": False}
        
        return {
            "exists": True,
            "room_id": room_id,
            "user_count": len(self.room_users[room_id]),
            "users": self.room_users[room_id]
        }

# Global connection manager instance
connection_manager = ConnectionManager()

# WebRTC Configuration with multiple STUN/TURN servers
WEBRTC_CONFIG = {
    "iceServers": [
        {"urls": "stun:stun.l.google.com:19302"},
        {"urls": "stun:stun1.l.google.com:19302"},
        {"urls": "stun:stun2.l.google.com:19302"},
        {"urls": "stun:stun3.l.google.com:19302"},
        {"urls": "stun:stun4.l.google.com:19302"}
    ],
    "iceCandidatePoolSize": 10
}

# Create static directory if it doesn't exist
static_dir = "static"
if not os.path.exists(static_dir):
    os.makedirs(static_dir)
    logger.info(f"Created static directory: {static_dir}")

# Mount static files
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def read_index():
    """Serve the main page"""
    try:
        return FileResponse('static/index.html')
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Index file not found")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0"
    }

@app.get("/api/rooms/{room_id}/info")
async def get_room_info(room_id: str):
    """Get information about a specific room"""
    room_info = connection_manager.get_room_info(room_id)
    return room_info

@app.get("/api/webrtc-config")
async def get_webrtc_config():
    """Get WebRTC configuration for clients"""
    return WEBRTC_CONFIG

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    """Enhanced WebSocket endpoint with better error handling"""
    user_id = None
    
    try:
        # Validate room_id
        if not room_id or len(room_id.strip()) == 0:
            await websocket.close(code=4000, reason="Invalid room ID")
            return
        
        # Connect user to room
        user_id = await connection_manager.connect_user(websocket, room_id)
        logger.info(f"User {user_id} connected to room {room_id}")
        
        # Message handling loop
        while True:
            try:
                # Wait for message with timeout
                data = await asyncio.wait_for(websocket.receive_json(), timeout=300.0)  # 5 minute timeout
                await connection_manager.handle_message(user_id, data)
                
            except asyncio.TimeoutError:
                logger.warning(f"WebSocket timeout for user {user_id}")
                break
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON from user {user_id}: {e}")
                await connection_manager.send_to_user(user_id, {
                    "type": "error",
                    "message": "Invalid message format"
                })
            except Exception as e:
                logger.error(f"Error processing message from user {user_id}: {e}")
                break
                
    except WebSocketDisconnect:
        logger.info(f"User {user_id} disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
    finally:
        if user_id:
            await connection_manager.disconnect_user(user_id)

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=404,
        content={"error": "Not found", "detail": str(exc)}
    )

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    from fastapi.responses import JSONResponse
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"}
    )

# Run the app
if __name__ == "__main__":
    import uvicorn
    
    # Configuration
    config = {
        "host": "0.0.0.0",
        "port": 8001,
        "log_level": "info",
        "access_log": True,
        "reload": False
    }
    
    logger.info(f"Starting server with config: {config}")
    uvicorn.run(app, **config)

