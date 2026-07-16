import {RenderModalCtx} from "datocms-plugin-sdk";
import {ValidConfig} from "../../types/config.ts";
import {Button, Canvas, Spinner, TextField, Toolbar} from "datocms-react-ui";
import {useEffect, useState} from "react";
import {useEntitySearch} from "../../hooks/useEntitySearch.ts";
import S from "./style.module.css"
import {ProductsGrid} from "../ProductsGrid";
import {BigcommerceEntity, BigcommerceEntityType, Category} from "../../types/entity.ts";
import {clearProductCache, isProductCacheWarmupInProgress} from "../../integration/searchProducts.ts";
import {clearCategoryCache} from "../../integration/searchCategories.ts";
import {clearBrandCache} from "../../integration/searchBrands.ts";

const SearchBar = (props: { value: string; onChange: (term: string) => void, entityType: BigcommerceEntityType }) => {
  return <TextField
    id={"search"}
    name={"search"}
    label={""}
    value={props.value}
    onChange={props.onChange}
    placeholder={`Search ${props.entityType}s...`}
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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [cacheRevision, setCacheRevision] = useState(0);
  const entitySearch = useEntitySearch(props.entityType, props.config, debouncedSearchTerm, true, cacheRevision);
  const activeState = entitySearch.state;
  const activeEntities = entitySearch.entities;
  const warmupInProgress = props.entityType === "product" && isProductCacheWarmupInProgress(props.config);
  const categoryTree =
    props.entityType === "category"
      ? buildCategoryTree(activeEntities as Category[])
      : [];

  useEffect(() => {
    props.ctx.stopAutoResizer();
    props.ctx.updateHeight(720);
  }, [props.ctx]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchTerm]);

  const handleClearCache = () => {
    if (props.entityType === "product") {
      clearProductCache(props.config);
    } else if (props.entityType === "category") {
      clearCategoryCache(props.config);
    } else if (props.entityType === "brand") {
      clearBrandCache(props.config);
    } else {
      return;
    }

    setSearchTerm("");
    setDebouncedSearchTerm("");
    setCacheRevision((value) => value + 1);
  };

  const canClearCache =
    props.entityType === "product" ||
    props.entityType === "category" ||
    props.entityType === "brand";

  return <Canvas ctx={props.ctx}>
    <Toolbar>
      <div style={{display: "flex", gap: 8, alignItems: "end", width: "100%"}}>
        <div style={{flex: "1 1 auto", minWidth: 0}}>
          <SearchBar value={searchTerm} onChange={v => setSearchTerm(v)} entityType={props.entityType}/>
        </div>
        {canClearCache ? (
          <div style={{flex: "0 0 112px"}}>
            <Button
              buttonType="muted"
              buttonSize="s"
              fullWidth
              onClick={handleClearCache}
            >
              Clear cache
            </Button>
          </div>
        ) : null}
      </div>
    </Toolbar>
    <div className={S.container}>
      {activeState === "loading" && activeEntities.length === 0 && <Spinner size={25} placement="centered"/>}
      {activeState === "error" && "There has been an error, please try again later."}
      {activeEntities.length === 0 && activeState === "idle" ? `No ${props.entityType}s found.` : null}
      {activeEntities.length > 0 ? <>
          {props.entityType === "category" ? (
            <CategoryTree
              nodes={categoryTree}
              onSelect={(category) => props.ctx.resolve(category)}
            />
          ) : <ProductsGrid
            products={activeEntities}
            onProductClick={(product: BigcommerceEntity) => props.ctx.resolve(product)}
          />}
        </>
        : null}
      {activeEntities.length > 0 && (activeState === "loading" || warmupInProgress) ? (
        <div className={S.loadMoreIndicator}>
          <Spinner size={16} />
          Loading more results in the background...
        </div>
      ) : null}
    </div>
  </Canvas>
}
