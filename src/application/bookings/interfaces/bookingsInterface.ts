export interface UserPayloadInterface {
  id?: string;     // si tu JwtStrategy.validate mete un id aquí
  sub?: string;    // payload crudo del JWT
  email: string;
  name?: string;
  role?: string;
}
