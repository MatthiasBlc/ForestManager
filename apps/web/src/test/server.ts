// Serveur MSW partage par les tests : chaque test ajoute ses handlers (server.use).
import { setupServer } from "msw/node";

export const server = setupServer();
