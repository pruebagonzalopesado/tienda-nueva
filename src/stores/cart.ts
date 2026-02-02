import { atom } from 'nanostores';

export interface CartItem {
  id: string;
  nombre: string;
  precio: number;
  imagen: string;
  cantidad: number;
  talla: string;
}

export const cartStore = atom<CartItem[]>([]);

export function addToCart(item: CartItem) {
  const current = cartStore.get();
  const existing = current.find(i => i.id === item.id && i.talla === item.talla);
  
  if (existing) {
    existing.cantidad += item.cantidad;
  } else {
    current.push(item);
  }
  
  cartStore.set([...current]);
  localStorage.setItem('cart', JSON.stringify(current));
}

export function removeFromCart(itemId: string) {
  const current = cartStore.get().filter(i => i.id !== itemId);
  cartStore.set(current);
  localStorage.setItem('cart', JSON.stringify(current));
}

export function updateQuantity(itemId: string, quantity: number) {
  const current = cartStore.get();
  const item = current.find(i => i.id === itemId);
  
  if (item) {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      item.cantidad = quantity;
      cartStore.set([...current]);
      localStorage.setItem('cart', JSON.stringify(current));
    }
  }
}

export function clearCart() {
  cartStore.set([]);
  localStorage.removeItem('cart');
}

export function loadCartFromStorage() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try {
        cartStore.set(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading cart:', e);
      }
    }
  }
}
