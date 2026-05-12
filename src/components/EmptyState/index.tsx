import {Button} from "datocms-react-ui";

export const EmptyState = ({onSelectProduct}: {
  onSelectProduct: () => void,
  entityType?: "product" | "brand" | "category",
}) =>
  <div>
    <Button onClick={onSelectProduct}
            buttonType={"primary"}
            buttonSize={"xs"}>
      Choose entity...
    </Button>
  </div>
