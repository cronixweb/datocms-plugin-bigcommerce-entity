import {RenderModalCtx} from "datocms-plugin-sdk";
import {ValidConfig} from "../../types/config.ts";
import {Button, Canvas, Spinner, TextField, Toolbar} from "datocms-react-ui";
import {useDebouncedCallback} from "use-debounce";
import {UIEvent, useEffect, useMemo, useState} from "react";
import {useEntitySearch} from "../../hooks/useEntitySearch.ts";
import S from "./style.module.css"
import {ProductsGrid} from "../ProductsGrid";
import {BigcommerceEntity, BigcommerceEntityType, Category} from "../../types/entity.ts";
import {useProductInfiniteSearch} from "../../hooks/useProductInfiniteSearch.ts";
import {useProductSkuSearch} from "../../hooks/useProductSkuSearch.ts";
import {isSkuLikeTerm} from "../../integration/searchProducts.ts";

const SearchBar = (props: { onChange: (term: string) => void, entityType: BigcommerceEntityType }) => {
  const debouncedOnChange = useDebouncedCallback(props.onChange, 1000)
  return <TextField
    id={"search"}
    name={"search"}
    label={""}
    value={undefined}
    onChange={debouncedOnChange}
    placeholder={props.entityType === "product" ? "Search products by name or SKU..." : `Search ${props.entityType}s...`}
  />
}

type CategoryTreeNode = {
  category: Category;
  children: CategoryTreeNode[];
};

const normalizePath = (path?: string) => (path || "").replace(/^\/+|\/+$/g, "");

const buildCategoryTree = (categories: Category[]): CategoryTreeNode[] => {
  const nodesByPath = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  categories.forEach((category) => {
    const path = normalizePath(category.path);
    const node: CategoryTreeNode = { category, children: [] };

    if (!path) {
      roots.push(node);
      return;
    }

    nodesByPath.set(path, node);
  });

  nodesByPath.forEach((node, path) => {
    const lastSlashIndex = path.lastIndexOf("/");
    if (lastSlashIndex <= 0) {
      roots.push(node);
      return;
    }

    const parentPath = path.slice(0, lastSlashIndex);
    const parentNode = nodesByPath.get(parentPath);
    if (parentNode) {
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (list: CategoryTreeNode[]) => {
    list.sort((a, b) => a.category.name.localeCompare(b.category.name));
    list.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
};

const CategoryTree = (props: {
  nodes: CategoryTreeNode[];
  onSelect: (category: Category) => void;
}) => {
  return (
    <div className={S.treeContainer}>
      {props.nodes.map((node) => (
        <CategoryTreeItem
          key={node.category.entityId}
          node={node}
          depth={0}
          onSelect={props.onSelect}
        />
      ))}
    </div>
  );
};

const CategoryTreeItem = (props: {
  node: CategoryTreeNode;
  depth: number;
  onSelect: (category: Category) => void;
}) => {
  const hasChildren = props.node.children.length > 0;

  return hasChildren ? (
    <details className={S.treeNode} open={props.depth < 1}>
      <summary className={S.treeSummary}>
        <span className={S.treeName}>{props.node.category.name}</span>
        <Button
          buttonType={"muted"}
          buttonSize={"xxs"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.onSelect(props.node.category);
          }}
        >
          Select
        </Button>
      </summary>
      <div className={S.treeChildren}>
        {props.node.children.map((child) => (
          <CategoryTreeItem
            key={child.category.entityId}
            node={child}
            depth={props.depth + 1}
            onSelect={props.onSelect}
          />
        ))}
      </div>
    </details>
  ) : (
    <div className={S.treeLeaf}>
      <span className={S.treeName}>{props.node.category.name}</span>
      <Button
        buttonType={"muted"}
        buttonSize={"xxs"}
        onClick={() => props.onSelect(props.node.category)}
      >
        Select
      </Button>
    </div>
  );
};

export const BrowseProductsModal = (props: { ctx: RenderModalCtx, config: ValidConfig, entityType: BigcommerceEntityType }) => {

  const [searchTerm, setSearchTerm] = useState("");
  const entitySearch = useEntitySearch(props.entityType, props.config, searchTerm, props.entityType !== "product");
  const skuSearchMode = props.entityType === "product" && isSkuLikeTerm(searchTerm);
  const productSearch = useProductInfiniteSearch(props.config, searchTerm, props.entityType === "product" && !skuSearchMode);
  const skuSearch = useProductSkuSearch(props.config, searchTerm, skuSearchMode);
  const activeState = props.entityType === "product"
    ? (
      productSearch.state === "error" || skuSearch.state === "error"
        ? "error"
        : skuSearchMode
          ? skuSearch.state
          : productSearch.state
          )
    : entitySearch.state;
  const activeEntities = useMemo(
    () => {
      if (props.entityType !== "product") {
        return entitySearch.entities;
      }

      return skuSearchMode ? skuSearch.products : productSearch.products;
    },
    [entitySearch.entities, productSearch.products, props.entityType, skuSearch.products, skuSearchMode],
  );
  const categoryTree =
    props.entityType === "category"
      ? buildCategoryTree(activeEntities as Category[])
      : [];

  useEffect(() => {
    props.ctx.stopAutoResizer();
    props.ctx.updateHeight(720);
  }, [props.ctx]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (props.entityType !== "product" || skuSearchMode || !productSearch.hasMore || productSearch.isLoadingMore) {
      return;
    }

    const target = event.currentTarget;
    const threshold = 80;
    const isNearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight <= threshold;

    if (isNearBottom) {
      productSearch.loadMore();
    }
  };

  return <Canvas ctx={props.ctx}>
    <Toolbar>
      <SearchBar onChange={v => setSearchTerm(v)} entityType={props.entityType}/>
    </Toolbar>
    <div className={S.container} onScroll={handleScroll}>
      {activeState === "loading" && <Spinner size={25} placement="centered"/>}
      {activeState === "error" && "There has been an error, please try again later."}
      {activeState === "idle" ? <>
          {activeEntities.length === 0 ? `No ${props.entityType}s found.` : props.entityType === "category" ? (
            <CategoryTree
              nodes={categoryTree}
              onSelect={(category) => props.ctx.resolve(category)}
            />
          ) : <ProductsGrid
            products={activeEntities}
            onProductClick={(product: BigcommerceEntity) => props.ctx.resolve(product)}
          />}
          {props.entityType === "product" && productSearch.isLoadingMore ? (
            <div className={S.loadMoreIndicator}><Spinner size={18} /> Loading more products...</div>
          ) : null}
        </>
        : null}
    </div>
  </Canvas>
}
