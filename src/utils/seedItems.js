import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const SEED_ITEMS = [
  {
    id: 'item_rumble_rumble',
    name: 'Rumble-Rumble Fruit',
    category: 'Devil Fruits',
    price: 4500,
    rarity: 'Legendary',
    emoji: '⚡',
    color: '#f59e0b',
    description: 'The most powerful Logia. Grants immunity to physical attacks and mastery over lightning.',
    stock: 1,
  },
  {
    id: 'item_gum_gum',
    name: 'Gum-Gum Fruit',
    category: 'Devil Fruits',
    price: 1200,
    rarity: 'Rare',
    emoji: '🌀',
    color: '#ef4444',
    description: 'Stretches your body like rubber. The fruit of the future King of the Pirates.',
    stock: 3,
  },
  {
    id: 'item_dark_dark',
    name: 'Dark-Dark Fruit',
    category: 'Devil Fruits',
    price: 5000,
    rarity: 'Legendary',
    emoji: '🌑',
    color: '#312e81',
    description: 'The power of darkness itself. Can nullify Devil Fruit powers on contact.',
    stock: 1,
  },
  {
    id: 'item_ope_ope',
    name: 'Op-Op Fruit',
    category: 'Devil Fruits',
    price: 3800,
    rarity: 'Epic',
    emoji: '💊',
    color: '#0ea5e9',
    description: 'The Ultimate Devil Fruit. Creates a "Room" where the user has total control over everything.',
    stock: 2,
  },
  {
    id: 'item_yoru',
    name: 'Yoru — Black Blade',
    category: 'Swords',
    price: 3200,
    rarity: 'Legendary',
    emoji: '⚔️',
    color: '#1e293b',
    description: "Mihawk's legendary black blade. One of the world's 12 Supreme Grade swords.",
    stock: 1,
  },
  {
    id: 'item_enma',
    name: 'Enma',
    category: 'Swords',
    price: 2800,
    rarity: 'Epic',
    emoji: '🗡️',
    color: '#7c3aed',
    description: "Oden's legendary blade. Drains the user's Haki and requires immense will to wield.",
    stock: 2,
  },
  {
    id: 'item_shusui',
    name: 'Shusui',
    category: 'Swords',
    price: 1800,
    rarity: 'Rare',
    emoji: '🔱',
    color: '#059669',
    description: 'A black blade of national treasure status from Wano. Enhanced with permanent Haki.',
    stock: 3,
  },
  {
    id: 'item_gomu_armor',
    name: 'Gear 4th Armor',
    category: 'Cosmetics',
    price: 950,
    rarity: 'Uncommon',
    emoji: '🦾',
    color: '#dc2626',
    description: "Luffy's Boundman transformation cosmetic skin. Bounce bounce!",
    stock: 10,
  },
  {
    id: 'item_marine_cape',
    name: 'Marine Justice Cape',
    category: 'Cosmetics',
    price: 450,
    rarity: 'Common',
    emoji: '🧥',
    color: '#2563eb',
    description: 'The iconic white cape worn by Marine admirals. Shows "Justice" on the back.',
    stock: 20,
  },
  {
    id: 'item_sea_stone',
    name: 'Sea Prism Stone Cuffs',
    category: 'Materials',
    price: 700,
    rarity: 'Uncommon',
    emoji: '💎',
    color: '#0f766e',
    description: 'Neutralizes Devil Fruit powers. Useful for trading or role-play PVP.',
    stock: 8,
  },
  {
    id: 'item_poneglyph',
    name: 'Road Poneglyph (Copy)',
    category: 'Materials',
    price: 8000,
    rarity: 'Legendary',
    emoji: '📜',
    color: '#92400e',
    description: 'A perfect rubbings copy of one of the 4 Road Poneglyphs leading to Laugh Tale.',
    stock: 1,
  },
  {
    id: 'item_wanted_poster',
    name: 'Custom Wanted Poster',
    category: 'Cosmetics',
    price: 300,
    rarity: 'Common',
    emoji: '📋',
    color: '#b45309',
    description: 'Personalized Beli bounty poster with your Roblox username and chosen bounty amount.',
    stock: 999,
  },
];

export async function seedItemsIfEmpty() {
  try {
    const snap = await getDocs(collection(db, 'items'));
    if (!snap.empty) return; // already seeded
    const writes = SEED_ITEMS.map(item =>
      setDoc(doc(db, 'items', item.id), {
        ...item,
        createdAt: new Date(),
      })
    );
    await Promise.all(writes);
    console.log('[seedItems] Seeded', SEED_ITEMS.length, 'items.');
  } catch (e) {
    console.warn('[seedItems] Failed:', e.message);
  }
}
