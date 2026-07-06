import type {RenderConfigScreenCtx} from 'datocms-plugin-sdk';
import {Button, Canvas, ContextInspector, FieldGroup, SwitchField, TextField} from 'datocms-react-ui';
import {Controller, useForm} from "react-hook-form";
import {normalizeConfig} from "../types/config.ts";
import {searchProductsPage} from "../integration/searchProducts.ts";

type Props = {
  ctx: RenderConfigScreenCtx;
};

export default function ConfigScreen({ctx}: Props) {
  const {handleSubmit, control, formState, reset} = useForm({
    defaultValues: normalizeConfig(ctx.plugin.attributes.parameters),
    mode: "onChange"
  });
  return (
    <Canvas ctx={ctx}>
      <form onSubmit={handleSubmit(data =>
        searchProductsPage("foo", data, 1, null)
          .then(() => ctx.updatePluginParameters(data))
          .then(() => ctx.notice('Settings updated successfully!'))
          .then(() => reset(data))
          .catch(() => ctx.alert('Failed to connect to BigCommerce, please check your settings.'))
      )}>
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
