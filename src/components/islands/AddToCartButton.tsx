import React, { useState } from 'react';

interface Props {
  productId: string;
  price: number;
  sizes?: string[];
}

export default function AddToCartButton({ productId, price, sizes = ['XS', 'S', 'M', 'L', 'XL'] }: Props) {
  const [selectedSize, setSelectedSize] = useState('M');
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddToCart = async () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      console.log('Added to cart:', { productId, selectedSize, quantity, price });
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Talla
        </label>
        <select
          value={selectedSize}
          onChange={(e) => setSelectedSize(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-900"
        >
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cantidad
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            −
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 text-center border border-gray-300 rounded-lg"
          />
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            +
          </button>
        </div>
      </div>

      <button
        onClick={handleAddToCart}
        disabled={isLoading}
        className="w-full bg-amber-900 text-white py-3 rounded-lg font-medium hover:bg-amber-800 disabled:bg-gray-400 transition-colors"
      >
        {isLoading ? 'Agregando...' : `Agregar al carrito - $${(price * quantity).toFixed(2)}`}
      </button>
    </div>
  );
}
