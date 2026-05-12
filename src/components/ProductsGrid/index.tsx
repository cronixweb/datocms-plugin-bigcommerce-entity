import React from "react";
import { BigcommerceEntity } from "../../types/entity.ts";
import S from "./style.module.css"

export const ProductsGrid: React.FC<{
  products: BigcommerceEntity[];
  onProductClick: (p: BigcommerceEntity) => void;
}> = ({ products, onProductClick }) => {
  return (
    <ul className={S.container}>
      {products.map((product) => (
        <li
          key={product.id}
          className={S.item}
          onClick={() => onProductClick(product)}
        >
          <span className={S.itemTitle}>{product.name}</span>
        </li>
      ))}
    </ul>
  );
};
