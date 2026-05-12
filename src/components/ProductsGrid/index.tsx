import React from "react";
import { BigcommerceEntity } from "../../types/entity.ts";
import S from "./style.module.css"

export const ProductsGrid: React.FC<{
  products: BigcommerceEntity[];
  onProductClick: (p: BigcommerceEntity) => void;
}> = ({ products, onProductClick }) => {
  const getImage = (product: BigcommerceEntity) =>
    "defaultImage" in product ? product.defaultImage?.urlOriginal : undefined;

  return (
    <div className={S.container}>
      {products.map((product) => (
        <article
          key={product.id}
          className={S.card}
          onClick={() => onProductClick(product)}
        >
          {getImage(product) ? <img src={getImage(product)} /> : null}
          <h1 className={S.cardTitle}>{product.name}</h1>
        </article>
      ))}
    </div>
  );
};
