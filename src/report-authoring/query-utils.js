import { resolveFieldReference } from "./semantic-model.js";

function escapeDaxIdentifier(value) {
  return String(value ?? "").replace(/'/g, "''");
}

export function toDaxObjectReference(parsedRef) {
  if (parsedRef.kind === "column") {
    return `'${escapeDaxIdentifier(parsedRef.tableName)}'[${parsedRef.columnName}]`;
  }

  if (parsedRef.kind === "measure") {
    return `'${escapeDaxIdentifier(parsedRef.tableName)}'[${parsedRef.measureName}]`;
  }

  return `'${escapeDaxIdentifier(parsedRef.tableName)}'[${parsedRef.hierarchyName}].[${parsedRef.levelName}]`;
}

export function buildNameOfReference(fieldRef, semanticModel) {
  const parsedRef =
    typeof fieldRef === "string" ? resolveFieldReference(fieldRef, semanticModel) : fieldRef;
  return `NAMEOF(${toDaxObjectReference(parsedRef)})`;
}

export function buildFieldExpression(parsedRef, aggregateColumns = false) {
  if (parsedRef.kind === "column") {
    const columnExpression = {
      Column: {
        Expression: {
          SourceRef: {
            Entity: parsedRef.tableName
          }
        },
        Property: parsedRef.columnName
      }
    };

    if (!aggregateColumns) {
      return {
        expression: columnExpression,
        queryRef: `${parsedRef.tableName}.${parsedRef.columnName}`
      };
    }

    return {
      expression: {
        Aggregation: {
          Expression: columnExpression,
          Function: 0
        }
      },
      queryRef: `Sum(${parsedRef.tableName}.${parsedRef.columnName})`
    };
  }

  if (parsedRef.kind === "measure") {
    return {
      expression: {
        Measure: {
          Expression: {
            SourceRef: {
              Entity: parsedRef.tableName
            }
          },
          Property: parsedRef.measureName
        }
      },
      queryRef: `${parsedRef.tableName}.${parsedRef.measureName}`
    };
  }

  return {
    expression: {
      HierarchyLevel: {
        Expression: {
          Hierarchy: {
            Expression: {
              SourceRef: {
                Entity: parsedRef.tableName
              }
            },
            Hierarchy: parsedRef.hierarchyName
          }
        },
        Level: parsedRef.levelName
      }
    },
    queryRef: `${parsedRef.tableName}.${parsedRef.hierarchyName}.${parsedRef.levelName}`
  };
}

export function buildFieldExpressionFromRef(fieldRef, semanticModel, aggregateColumns = false) {
  const parsedRef = typeof fieldRef === "string" ? resolveFieldReference(fieldRef, semanticModel) : fieldRef;
  return buildFieldExpression(parsedRef, aggregateColumns);
}

export function resolveFieldExpressions(fieldRefs, semanticModel) {
  return (fieldRefs || []).map((fieldRef) => {
    const parsedRef =
      typeof fieldRef === "string" ? resolveFieldReference(fieldRef, semanticModel) : fieldRef;
    return {
      parsedRef,
      built: buildFieldExpression(parsedRef, false)
    };
  });
}
