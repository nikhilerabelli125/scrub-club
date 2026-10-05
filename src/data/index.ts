// Content schemas and validation (docs/07 §4). Pure, so tools and tests use it in Node. Lane D.
export * from './schema';
export { validateData, type DataFile, type DataIssue } from './validate';
