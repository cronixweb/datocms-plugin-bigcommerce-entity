import {useEntity} from "../../hooks/useEntity.ts";
import {ValidConfig} from "../../types/config.ts";
import {Button, Spinner} from "datocms-react-ui";
import styles from "./style.module.css"
import {BigcommerceEntity, BigcommerceEntityType, EntityIdKey} from "../../types/entity.ts";

const isProductEntity = (entity: BigcommerceEntity): entity is BigcommerceEntity & {
  prices: {
    price: {
      value: number;
      currencyCode: string;
    };
  };
  availabilityV2: {
    status: string;
  };
} => "prices" in entity && "availabilityV2" in entity;

const getEntityImage = (entity: BigcommerceEntity): string | undefined =>
  "defaultImage" in entity ? entity.defaultImage?.urlOriginal : undefined;

export const SelectedProductDetails = ({
                                 productId,
                                 idKey,
                                 entityType,
                                 config,
                                 onReset,
                                 onSelectAnotherProduct
                               }: {
  productId: string | number,
  idKey: EntityIdKey,
  entityType: BigcommerceEntityType,
  config: ValidConfig,
  onReset: () => void,
  onSelectAnotherProduct: () => void
}) => {
  const {entity, state, retry} = useEntity(entityType, productId, idKey, config);
  const image = entity ? getEntityImage(entity) : undefined;

  return (
    <div className={styles['productDetailsContainer']}>
      {entity && (
        <>
          {image ? <img
            className={styles.productDetailsImage}
            src={image}
          /> : null}
          <h1 className={styles.productDetailsTitle}>{entity.name}</h1>
          <div className={styles.productDetailsDescription}>
            {"plainTextDescription" in entity && entity.plainTextDescription ? entity.plainTextDescription : ("path" in entity ? entity.path : null)}
          </div>
          {isProductEntity(entity) ? <div className={styles.productDetailsPrice}>
            {entity.prices.price.currencyCode} {entity.prices.price.value} -{" "}
            {entity.availabilityV2.status}
          </div> : null}

          <div className={styles.actionsRow}>
            <Button
              onClick={onSelectAnotherProduct}
              buttonType={"muted"}
              buttonSize={"xs"}>
              Replace...
            </Button>
            <Button
              onClick={onReset}
              className={styles.productDetailsClear}
              buttonType={"negative"}
              buttonSize={"xs"}

            >
              Clear
            </Button>
          </div>
        </>
      )}

      {state === "loading" && <Spinner placement={"centered"}/>}
      {((state === "idle" && !entity) || state === "error") && (
        <div className={styles.searchState}>
          <div>{state === "error" ? `There has been an error fetching the ${entityType}.` : `${entityType} not found...`}</div>
        <div className={styles.actionsRow} style={{marginRight: "auto", justifyContent: "start", marginTop: 8}}>
          <Button buttonType={"primary"} buttonSize={"xs"} onClick={retry}>Retry</Button>
          <Button buttonType={"negative"} buttonSize={"xs"} onClick={onSelectAnotherProduct}>Replace...</Button>
        </div>
        </div>
      )}
    </div>
  );
};
