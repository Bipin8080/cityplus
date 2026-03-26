export const sendSuccess = (res, message, data = null, statusCode = 200) => {
  const payload = {
    success: true,
    message
  };

  if (data !== null) {
    payload.data = data;

    if (typeof data === "object" && !Array.isArray(data)) {
      Object.assign(payload, data);
    }
  }

  return res.status(statusCode).json(payload);
};

export const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const requireFields = (values, entries) => {
  const missing = entries
    .filter(([key]) => {
      const value = values[key];
      return value === undefined || value === null || value === "";
    })
    .map(([, label]) => label);

  if (missing.length > 0) {
    throw createHttpError(`${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} required`, 400);
  }
};
