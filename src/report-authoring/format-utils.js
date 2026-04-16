export function quoteLiteral(value) {
  const escaped = String(value ?? "").replace(/'/g, "''");
  return {
    expr: {
      Literal: {
        Value: `'${escaped}'`
      }
    }
  };
}

export function booleanLiteral(value) {
  return {
    expr: {
      Literal: {
        Value: value ? "true" : "false"
      }
    }
  };
}

export function numberLiteral(value) {
  return {
    expr: {
      Literal: {
        Value: String(value)
      }
    }
  };
}

export function ensureArrayObject(target, key) {
  if (!target[key]) {
    target[key] = [];
  }
  if (!target[key][0]) {
    target[key][0] = { properties: {} };
  }
  if (!target[key][0].properties) {
    target[key][0].properties = {};
  }
  return target[key][0].properties;
}

export function setAnnotation(target, name, value) {
  target.annotations = target.annotations || [];
  const existing = target.annotations.find((annotation) => annotation.name === name);
  if (existing) {
    existing.value = String(value);
    return;
  }

  target.annotations.push({
    name,
    value: String(value)
  });
}

export function getAnnotation(target, name) {
  return target.annotations?.find((annotation) => annotation.name === name)?.value ?? null;
}
