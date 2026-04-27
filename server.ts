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
  let enemies: any[] = [];
  let gameTime = 0;
  let wave = 1;

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join", (playerData) => {
      players[socket.id] = { ...playerData, id: socket.id };
      io.emit("players_update", players);
    });

    socket.on("move", (pos) => {
      if (players[socket.id]) {
        players[socket.id].pos = pos;
        socket.broadcast.emit("player_moved", { id: socket.id, pos });
      }
    });

    socket.on("player_state", (playerState) => {
       if (players[socket.id]) {
         players[socket.id] = { ...players[socket.id], ...playerState };
         socket.broadcast.emit("player_state_update", { id: socket.id, state: playerState });
       }
    });

    socket.on("fire", (projectile) => {
      socket.broadcast.emit("projectile_spawned", { ...projectile, ownerId: socket.id });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      delete players[socket.id];
      io.emit("players_update", players);
    });
    
    // For syncing enemies in multiplayer
    socket.on("sync_enemies", (newEnemies) => {
       // Simple approach: the first player acts as the "host" for enemies
       // In a real production app, the server would run the physics
       if (Object.keys(players)[0] === socket.id) {
         enemies = newEnemies;
         socket.broadcast.emit("enemies_update", enemies);
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
