import React from "react";
import { BigcommerceEntity } from "../../types/entity.ts";
import S from "./style.module.css"

export const ProductsGrid: React.FC<{
  products: BigcommerceEntity[];
  onProductClick: (p: BigcommerceEntity) => void;
}> = ({ products, onProductClick }) => {
  const getSku = (entity: BigcommerceEntity) =>
    "sku" in entity ? entity.sku : undefined;

  return (
    <ul className={S.container}>
      {products.map((product) => (
        <li
          key={product.id}
          className={S.item}
          onClick={() => onProductClick(product)}
        >
          <span className={S.itemTitle}>{product.name}</span>
          {getSku(product) ? <span className={S.itemMeta}>SKU: {getSku(product)}</span> : null}
        </li>
      ))}
    </ul>
  );
};
