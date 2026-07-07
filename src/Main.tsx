import { connect } from "datocms-plugin-sdk";
import "datocms-react-ui/styles.css";
import ConfigScreen from "./entrypoints/ConfigScreen";
import { render } from "./utils/render";
import { FieldConfigScreen } from "./entrypoints/FieldConfigScreen.tsx";
import { FieldExtension } from "./entrypoints/FieldExtension.tsx";
import { BrowseProductsModal } from "./components/BrowseProductsModal";
import { isValidConfig, normalizeConfig } from "./types/config.ts";
import { BigcommerceEntityType } from "./types/entity.ts";

const FIELD_EXTENSION_ID = "bigcommerceProduct";

connect({
  async onBoot(ctx) {
    if (
      !ctx.currentRole.meta.final_permissions.can_edit_schema ||
      isValidConfig(ctx.plugin.attributes.parameters)
    ) {
      return;
    }

    const fields = await ctx.loadFieldsUsingPlugin();

    const someUpgraded = (
      await Promise.all(
        fields.map(async (field) => {
          if (
            field.attributes.appearance.editor !== ctx.plugin.id ||
            field.attributes.appearance.field_extension === FIELD_EXTENSION_ID
          ) {
            return false;
          }

          await ctx.updateFieldAppearance(field.id, [
            {
              operation: "updateEditor",
              newFieldExtensionId: FIELD_EXTENSION_ID,
            },
          ]);

          return true;
        }),
      )
    ).some((x) => x);

    await ctx.updatePluginParameters(
      normalizeConfig(ctx.plugin.attributes.parameters),
    );

    if (someUpgraded) {
      ctx.notice("Plugin upgraded successfully!");
    }
  },
  manualFieldExtensions() {
    return [
      {
        id: FIELD_EXTENSION_ID,
        name: "BigCommerce Entity",
        type: "editor",
        fieldTypes: ["string", "integer"],
        configurable: true,
      },
    ];
  },
  renderManualFieldExtensionConfigScreen(fieldExtensionId, ctx) {
    return render(
      <FieldConfigScreen ctx={ctx} extensionId={fieldExtensionId} />,
    );
  },
  renderConfigScreen(ctx) {
    return render(<ConfigScreen ctx={ctx} />);
  },
  renderFieldExtension(_id, ctx) {
    render(<FieldExtension ctx={ctx} />);
  },
  renderModal(modalId, ctx) {
    if (
      !["browseProducts", "browseBrands", "browseCategories"].includes(modalId)
    ) {
      return null;
    }

    const inferredEntityType: BigcommerceEntityType =
      modalId === "browseBrands"
        ? "brand"
        : modalId === "browseCategories"
          ? "category"
          : "product";

    return render(
      <BrowseProductsModal
        ctx={ctx}
        config={normalizeConfig(ctx.plugin.attributes.parameters)}
        entityType={
          (ctx.parameters as { entityType?: BigcommerceEntityType })
            ?.entityType || inferredEntityType
        }
      />,
    );
  },
});
