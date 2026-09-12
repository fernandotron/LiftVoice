import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class UserManager {
  constructor() {
    this.users = new Map();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const data = fs.readFileSync(USERS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        for (const [id, user] of Object.entries(parsed)) {
          this.users.set(id, user);
        }
      }
    } catch (e) {
      console.error('Failed to load users', e);
    }
  }

  save() {
    try {
      const obj = Object.fromEntries(this.users);
      fs.writeFileSync(USERS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save users', e);
    }
  }

  getOrCreateUser(id, { name, email, phone }) {
    if (!id && !email) return null;
    
    // Find by email first if we have it
    if (email) {
      for (const [uid, user] of this.users.entries()) {
        if (user.email === email) {
          if (name && !user.name) user.name = name;
          if (phone && !user.phone) user.phone = phone;
          user.lastSeen = new Date().toISOString();
          this.save();
          return user;
        }
      }
    }

    const userId = id || email;
    if (this.users.has(userId)) {
      const user = this.users.get(userId);
      user.lastSeen = new Date().toISOString();
      if (name) user.name = name;
      if (email) user.email = email;
      if (phone) user.phone = phone;
      this.save();
      return user;
    }

    const newUser = {
      id: userId,
      name: name || 'Anonymous',
      email: email || '',
      phone: phone || '',
      role: 'listener', // listener, host, admin_master
      status: 'Activo', // Activo, Suspendido
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      lastRoom: null
    };

    this.users.set(userId, newUser);
    this.save();
    return newUser;
  }

  updateUserLastRoom(id, roomId) {
    if (!id) return;
    const user = this.users.get(id);
    if (user) {
      user.lastRoom = roomId;
      this.save();
    }
  }

  updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) return null;
    if (updates.role) user.role = updates.role;
    if (updates.status) user.status = updates.status;
    this.save();
    return user;
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }

  getUser(id) {
    return this.users.get(id);
  }
}

export const userManager = new UserManager();
