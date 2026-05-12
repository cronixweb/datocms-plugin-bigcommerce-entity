import {RenderModalCtx} from "datocms-plugin-sdk";
import {ValidConfig} from "../../types/config.ts";
import {Canvas, Spinner, TextField, Toolbar} from "datocms-react-ui";
import {useDebouncedCallback} from "use-debounce";
import {useState} from "react";
import {useEntitySearch} from "../../hooks/useEntitySearch.ts";
import S from "./style.module.css"
import {ProductsGrid} from "../ProductsGrid";
import {BigcommerceEntityType} from "../../types/entity.ts";

const SearchBar = (props: { onChange: (term: string) => void, entityType: BigcommerceEntityType }) => {
  const debouncedOnChange = useDebouncedCallback(props.onChange, 1000)
  return <TextField
    id={"search"}
    name={"search"}
    label={""}
    value={undefined}
    onChange={debouncedOnChange}
    placeholder={`Search ${props.entityType}s...`}
  />
}

export const BrowseProductsModal = (props: { ctx: RenderModalCtx, config: ValidConfig, entityType: BigcommerceEntityType }) => {

  const [searchTerm, setSearchTerm] = useState("");
  const entitySearch = useEntitySearch(props.entityType, props.config, searchTerm);

  return <Canvas ctx={props.ctx}>
    <Toolbar>
      <SearchBar onChange={v => setSearchTerm(v)} entityType={props.entityType}/>
    </Toolbar>
    <div className={S.container}>
      {entitySearch.state === "loading" && <Spinner size={25} placement="centered"/>}
      {entitySearch.state === "error" && "There has been an error, please try again later."}
      {entitySearch.state === "idle" ? <>
          {entitySearch.entities.length === 0 ? `No ${props.entityType}s found.` : <ProductsGrid
            products={entitySearch.entities}
            onProductClick={product => props.ctx.resolve(product)}
          />}
        </>
        : null}
    </div>
  </Canvas>
}
