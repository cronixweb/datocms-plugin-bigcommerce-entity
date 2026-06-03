import type {RenderConfigScreenCtx} from 'datocms-plugin-sdk';
import {Button, Canvas, ContextInspector, FieldGroup, SwitchField, TextField} from 'datocms-react-ui';
import {Controller, useForm} from "react-hook-form";
import {normalizeConfig, ValidConfig} from "../types/config.ts";
import {searchProducts} from "../integration/searchProducts.ts";

type Props = {
  ctx: RenderConfigScreenCtx;
};

type ConfigFormValues = ValidConfig & {
  extraCategoryRootEntityIdsInput: string;
};

const parseExtraCategoryRootEntityIds = (value: string): number[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);

export default function ConfigScreen({ctx}: Props) {
  const normalizedConfig = normalizeConfig(ctx.plugin.attributes.parameters);
  const {handleSubmit, control, formState, reset} = useForm({
    defaultValues: {
      ...normalizedConfig,
      extraCategoryRootEntityIdsInput: normalizedConfig.extraCategoryRootEntityIds?.join(", ") || "",
    } satisfies ConfigFormValues,
    mode: "onChange"
  });
  return (
    <Canvas ctx={ctx}>
      <form onSubmit={handleSubmit((data) => {
        const { extraCategoryRootEntityIdsInput, ...configFields } = data;
        const nextConfig: ValidConfig = {
          ...configFields,
          extraCategoryRootEntityIds: parseExtraCategoryRootEntityIds(extraCategoryRootEntityIdsInput),
        };
        return searchProducts("foo", nextConfig)
          .then(() => ctx.updatePluginParameters(nextConfig))
          .then(() => ctx.notice('Settings updated successfully!'))
          .then(() => reset({
            ...nextConfig,
            extraCategoryRootEntityIdsInput: nextConfig.extraCategoryRootEntityIds?.join(", ") || "",
          }))
          .catch(() => ctx.alert('Failed to connect to BigCommerce, please check your settings.'))
      })}>
        <FieldGroup>
          <Controller
            rules={{required: true}}
            name={"graphqlEndpoint"}
            control={control}
            render={({field, fieldState}) => <TextField
              id={field.name}
              label={"BigCommerce store front graphql endpoint"}
              name={field.name}
              onChange={field.onChange}
              value={field.value}
              error={fieldState.error?.message}
              required/>
            }
          />

          <Controller
            rules={{required: true}}
            name={"authorizationToken"}
            control={control}
            render={({field, fieldState}) => <TextField
              id={field.name}
              label={"Storefront API authorization token"}
              name={field.name}
              onChange={field.onChange}
              value={field.value}
              error={fieldState.error?.message}
              required/>
            }
          />
          <Controller
            name={"isStoreEntityIdByDefault"}
            control={control}
            render={({field}) => <SwitchField
              id={field.name}
              name={field.name}
              value={field.value as boolean}
              onChange={field.onChange}
              label={"Use products' entityId by default?"}
              hint={"By default, use products entityId (numeric) instead of storefront API ids."}
            />}
          />
          <Controller
            name={"extraCategoryRootEntityIdsInput"}
            control={control}
            render={({field, fieldState}) => <TextField
              id={field.name}
              label={"Extra category root entity IDs"}
              name={field.name}
              onChange={field.onChange}
              value={field.value}
              error={fieldState.error?.message}
              hint={"Optional comma-separated category entity IDs whose branches should be fetched explicitly."}
            />}
          />
        </FieldGroup>
        <Button
          type="submit"
          fullWidth
          buttonSize="l"
          buttonType="primary"
          disabled={formState.isSubmitting || !formState.isValid || !formState.isDirty}
          style={{marginTop: '1rem'}}
        >
          Test connection and save settings
        </Button>
      </form>
      {process.env.NODE_ENV === "development" && <div>
        <ContextInspector/>
      </div>}
    </Canvas>
  );
}
