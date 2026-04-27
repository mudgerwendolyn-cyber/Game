import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Simple state management on server
  let players: Record<string, any> = {};
  let rooms: Record<string, { members: string[], host: string, started: boolean }> = {};

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("create_room", () => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      rooms[roomId] = { members: [socket.id], host: socket.id, started: false };
      socket.join(roomId);
      socket.emit("room_created", roomId);
      
      io.to(roomId).emit("room_update", { 
        members: rooms[roomId].members, 
        memberStates: [{ id: socket.id }],
        host: rooms[roomId].host,
        roomId 
      });
    });

    socket.on("join_room", (roomId) => {
      if (rooms[roomId]) {
        if (rooms[roomId].started) {
          socket.emit("room_error", "游戏已开始");
          return;
        }
        if (rooms[roomId].members.length >= 4) {
          socket.emit("room_error", "房间已满 (最多4位玩家)");
          return;
        }
        if (!rooms[roomId].members.includes(socket.id)) {
          rooms[roomId].members.push(socket.id);
          socket.join(roomId);
        }
        
        const memberStates = rooms[roomId].members.map(id => players[id] || { id });

        io.to(roomId).emit("room_update", { 
          members: rooms[roomId].members, 
          memberStates,
          host: rooms[roomId].host,
          roomId 
        });
      } else {
        socket.emit("room_error", "房间未找到");
      }
    });

    socket.on("start_game", (roomId) => {
      if (rooms[roomId] && rooms[roomId].host === socket.id) {
        if (rooms[roomId].members.length < 2) {
          socket.emit("room_error", "至少需要两名玩家才能开始多人模式");
          return;
        }
        rooms[roomId].started = true;
        io.to(roomId).emit("game_started");
      }
    });

    socket.on("join", (playerData) => {
      players[socket.id] = { ...playerData, id: socket.id };
      // Check which room the player is in and notify that room
      for (const roomId in rooms) {
        if (rooms[roomId].members.includes(socket.id)) {
          io.to(roomId).emit("players_update", rooms[roomId].members.reduce((acc, id) => {
            if (players[id]) acc[id] = players[id];
            return acc;
          }, {} as any));
        }
      }
    });

    socket.on("move", (pos) => {
      if (players[socket.id]) {
        players[socket.id].pos = pos;
        // Broadcast to relevant room
        for (const roomId in rooms) {
          if (rooms[roomId].members.includes(socket.id)) {
            socket.to(roomId).emit("player_moved", { id: socket.id, pos });
            break;
          }
        }
      }
    });

    socket.on("player_state", (playerState) => {
      if (players[socket.id]) {
        players[socket.id] = { ...players[socket.id], ...playerState };
        for (const roomId in rooms) {
          if (rooms[roomId].members.includes(socket.id)) {
            socket.to(roomId).emit("player_state_update", { id: socket.id, state: playerState });
            break;
          }
        }
      }
    });

    socket.on("fire", (projectile) => {
      for (const roomId in rooms) {
        if (rooms[roomId].members.includes(socket.id)) {
          socket.to(roomId).emit("projectile_spawned", { ...projectile, ownerId: socket.id });
          break;
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      delete players[socket.id];
      
      for (const roomId in rooms) {
        if (rooms[roomId].members.includes(socket.id)) {
          rooms[roomId].members = rooms[roomId].members.filter(id => id !== socket.id);
          
          if (rooms[roomId].members.length === 0) {
            delete rooms[roomId];
          } else {
            if (rooms[roomId].host === socket.id) {
              rooms[roomId].host = rooms[roomId].members[0];
            }
            io.to(roomId).emit("room_update", { 
              members: rooms[roomId].members, 
              host: rooms[roomId].host,
              roomId 
            });
          }
        }
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
