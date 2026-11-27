// Type declarations for SQL files imported as text in tests.
declare module "*.sql" {
  const content: string;
  export default content;
}
