export const isSafeIdentifier = (name) =>{
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}