export type FirstInstallationParameters = {};

export type ValidConfig = {
  graphqlEndpoint: string;
  authorizationToken: string;
  isStoreEntityIdByDefault?: boolean;
  extraCategoryRootEntityIds?: number[];
  paramsVersion: '2';
};


export type Config = ValidConfig | FirstInstallationParameters;

export function isValidConfig(params: Config): params is ValidConfig {
  return params && 'paramsVersion' in params && params.paramsVersion === '2';
}

export function normalizeConfig(params: Config): ValidConfig {
  if (isValidConfig(params)) {
    return {
      ...params,
      extraCategoryRootEntityIds: Array.isArray(params.extraCategoryRootEntityIds)
        ? params.extraCategoryRootEntityIds
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
        : [],
    };
  }

  return {
    paramsVersion: '2',
    authorizationToken:
      'authorizationToken' in params
        ? params.authorizationToken as string
        : '',
    graphqlEndpoint: 'graphqlEndpoint' in params ? params.graphqlEndpoint as string : '',
    isStoreEntityIdByDefault: 'isStoreEntityIdByDefault' in params ? params.isStoreEntityIdByDefault as boolean : false,
    extraCategoryRootEntityIds:
      'extraCategoryRootEntityIds' in params && Array.isArray(params.extraCategoryRootEntityIds)
        ? params.extraCategoryRootEntityIds
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
        : [],
  };
}
