import {RenderFieldExtensionCtx} from "datocms-plugin-sdk";
import {normalizeConfig} from "../types/config.ts";
import {Canvas, ContextInspector} from "datocms-react-ui";
import {BigcommerceEntity, BigcommerceEntityType, EntityIdKey} from "../types/entity.ts";
import {EmptyState} from "../components/EmptyState";
import {FieldBackground} from "../components/FieldBackground";
import {SelectedProductDetails} from "../components/SelectedProductDetails";

export const FieldExtension = ({ctx}: { ctx: RenderFieldExtensionCtx }) => {
  const fieldType = ctx.field.attributes.field_type;

  const currentValue = ctx.formValues[ctx.fieldPath] as string | number | null

  const pluginConfig = normalizeConfig(ctx.plugin.attributes.parameters)
  const fieldConfig = ctx.field.attributes.appearance.parameters as unknown as { idType: "id" | "entityId", entityType?: BigcommerceEntityType }
  const runtimeConfig = (ctx.parameters as { entityType?: BigcommerceEntityType, idType?: EntityIdKey } | undefined) || {};
  const entityType = runtimeConfig.entityType || fieldConfig.entityType || "product";

  let graphqlIdField: EntityIdKey;
  if (fieldType === "integer")
    graphqlIdField = "entityId"
  else
    switch (fieldConfig.idType) {
      case "entityId":
      case "id":
        graphqlIdField = fieldConfig.idType;
        break;
      default:
        graphqlIdField = pluginConfig.isStoreEntityIdByDefault ? "entityId" : "id";
    }

  const handleReset = () => {
    ctx.setFieldValue(ctx.fieldPath, null);
  };

  const triggerModal = async () => {
    const modalId = entityType === "brand"
      ? "browseBrands"
      : entityType === "category"
        ? "browseCategories"
        : "browseProducts";

    const entity = (await ctx.openModal({
      id: modalId,
      title: `Select BigCommerce ${entityType}`,
      width: 'xl',
      parameters: { entityType },
    })) as BigcommerceEntity | null;

    if (entity) {
      ctx.setFieldValue(
        ctx.fieldPath,
        fieldType !== "integer" ? String(entity[graphqlIdField]) : entity[graphqlIdField],
      );
    }
  };

  return <Canvas ctx={ctx}>
    <FieldBackground>
      {currentValue ?
        <SelectedProductDetails
          productId={currentValue}
          idKey={graphqlIdField}
          entityType={entityType}
          config={pluginConfig}
          onReset={handleReset}
          onSelectAnotherProduct={triggerModal}
        />
        : <EmptyState onSelectProduct={triggerModal}/>
      }
    </FieldBackground>
    {process.env.NODE_ENV === "development" && <div>
      <ContextInspector/>
    </div>}
  </Canvas>
}
