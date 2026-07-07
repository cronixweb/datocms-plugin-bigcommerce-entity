import {useEffect, useState} from "react";
import {searchProducts} from "../integration/searchProducts";
import {Product} from "../types/product";
import {ValidConfig} from "../types/config.ts";

export const useProductSearch = (config: ValidConfig, term: string) => {

  const [state, setState] = useState<"loading" | "error" | "idle">("idle")
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    setState("loading");
    setProducts([]);

    searchProducts(term, config)
      .then((products) => {
        setProducts(products);
      })
      .then(() => setState("idle"))
      .catch((e) => {
        console.error(e);
        setState("error")
      })

    return () => {
    };
  }, [term]);

  return {state, products};
};
