export interface User {
  id: string;
  name: string;
  email: string;
}

/** The session itself is an HttpOnly cookie; the body only says who signed in. */
export interface AuthResponse {
  user: User;
}
