import {RenderFieldExtensionCtx} from "datocms-plugin-sdk";
import {normalizeConfig} from "../types/config.ts";
import {Canvas, ContextInspector} from "datocms-react-ui";
import {
  BigcommerceEntity,
  EntityIdKey,
  FieldExtensionParameters,
} from "../types/entity.ts";
import {EmptyState} from "../components/EmptyState";
import {FieldBackground} from "../components/FieldBackground";
import {SelectedProductDetails} from "../components/SelectedProductDetails";

function getValueFromPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (Array.isArray(acc)) {
      const index = parseInt(key, 10);
      return Number.isNaN(index) ? undefined : acc[index];
    }

    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }

    return undefined;
  }, obj);
}

function getSiblingFieldPath(fieldPath: string, currentApiKey: string, siblingApiKey?: string): string | null {
  if (!siblingApiKey) {
    return null;
  }

  const parts = fieldPath.split(".");

  if (parts.at(-1) !== currentApiKey) {
    return null;
  }

  parts[parts.length - 1] = siblingApiKey;
  return parts.join(".");
}

export const FieldExtension = ({ctx}: { ctx: RenderFieldExtensionCtx }) => {
  const fieldType = ctx.field.attributes.field_type;

  const currentValue = getValueFromPath(ctx.formValues, ctx.fieldPath) as
    | string
    | number
    | null;

  const pluginConfig = normalizeConfig(ctx.plugin.attributes.parameters)
  const fieldConfig = ctx.field.attributes.appearance.parameters as FieldExtensionParameters;
  const runtimeConfig = (ctx.parameters as FieldExtensionParameters | undefined) || {};
  const entityType = runtimeConfig.entityType || fieldConfig.entityType || "product";
  const labelFieldPath = getSiblingFieldPath(
    ctx.fieldPath,
    ctx.field.attributes.api_key,
    runtimeConfig.labelFieldApiKey || fieldConfig.labelFieldApiKey,
  );

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
    if (labelFieldPath) {
      ctx.setFieldValue(labelFieldPath, null);
    }
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
      await ctx.setFieldValue(
        ctx.fieldPath,
        fieldType !== "integer" ? String(entity[graphqlIdField]) : entity[graphqlIdField],
      );
      if (labelFieldPath) {
        await ctx.setFieldValue(labelFieldPath, entity.name);
      }
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
