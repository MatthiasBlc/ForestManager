Voici l'ordre de developpement base sur le DEVELOPMENT_ROADMAP.md:  
                                                                      
  Ordre d'execution                                                   
                                                                      
  Phase 0 ─────► Phase 0.5 ─────► Phase 1 ─────► Phase 2              
  (Setup)       (SuperAdmin)     (Auth)         (Catalogue)           
     │               │               │               │                
     ▼               ▼               ▼               ▼                
  [x] Fait      [ ] A faire     [ ] Ensuite    [ ] Apres              
                                                                      
  ---                                                                 
  1. Phase 0 - Setup (Partiellement fait)                             
                                                                      
  Restant a faire:                                                    
  - Copier docs/PRISMA_SCHEMA.prisma → backend/prisma/schema.prisma   
  - npx prisma migrate dev (creer toutes les tables)                  
  - Configurer .env (SESSION_SECRET, ADMIN_SESSION_SECRET,            
  DATABASE_URL)                                                       
  - Installer @quixo3/prisma-session-store                            
  - Structurer les dossiers (services/, middleware/, admin/)          
                                                                      
  ---                                                                 
  2. Phase 0.5 - SuperAdmin & Briques (Prioritaire)                   
                                                                      
  Pourquoi en premier?                                                
  - Le Feature MVP doit exister AVANT de creer des communautes        
  - Le SuperAdmin permet de gerer la plateforme des le depart         
                                                                      
  Taches:                                                             
  1. Installer otplib, qrcode                                         
  2. Creer le module admin/ isole                                     
  3. Configurer le double session store                               
  4. Implementer CLI npm run admin:create                             
  5. Routes auth admin (login 2FA, logout)                            
  6. Seed Feature MVP (isDefault: true)                               
  7. Routes admin CRUD (tags, ingredients, communities, features)     
                                                                      
  ---                                                                 
  3. Phase 1 - Auth Utilisateurs                                      
                                                                      
  Taches:                                                             
  1. Routes /api/auth/* (signup, login, logout, me)                   
  2. Middleware requireAuth                                           
  3. Frontend: pages Login/Signup                                     
  4. Context AuthProvider + hook useAuth                              
  5. Layout de base (header, sidebar)                                 
                                                                      
  ---                                                                 
  4. Phases suivantes (dans l'ordre)                                  
  ┌───────┬───────────────────────────────────────────┬───────────┐   
  │ Phase │                Description                │ Depend de │   
  ├───────┼───────────────────────────────────────────┼───────────┤   
  │ 2     │ Catalogue personnel (CRUD recettes perso) │ Phase 1   │   
  ├───────┼───────────────────────────────────────────┼───────────┤   
  │ 3     │ Communautes & Invitations                 │ Phase 2   │   
  ├───────┼───────────────────────────────────────────┼───────────┤   
  │ 4     │ Recettes communautaires                   │ Phase 3   │   
  ├───────┼───────────────────────────────────────────┼───────────┤   
  │ 5     │ Propositions & Variantes                  │ Phase 4   │   
  ├───────┼───────────────────────────────────────────┼───────────┤   
  │ 6     │ Activity Feed                             │ Phase 5   │   
  ├───────┼───────────────────────────────────────────┼───────────┤   
  │ 7     │ Partage inter-communautes                 │ Phase 3   │   
  ├───────┼───────────────────────────────────────────┼───────────┤   
  │ 8     │ Finitions MVP                             │ Tout      │   
  └───────┴───────────────────────────────────────────┴───────────┘   
  ---                                                                 
  Proposition de demarrage                                            
                                                                      
  On commence par Phase 0 (finalisation) puis Phase 0.5?              
                                                                      
  Premiere action concrete:                                           
  # 1. Copier le schema                                               
  cp docs/PRISMA_SCHEMA.prisma backend/prisma/schema.prisma           
                                                                      
  # 2. Appliquer la migration                                         
  cd backend && npx prisma migrate dev --name init_forest_manager     
                                                                      
  # 3. Installer les deps                                             
  npm install @quixo3/prisma-session-store otplib qrcode              
  npm install -D @types/qrcode                                        
                                                                      
  Tu veux qu'on commence?                                             
                                                                      
● Ran 1 stop hook                                                     
  ⎿  Stop hook error: Failed with non-blocking status code:           
  /bin/sh: 1: afplay: not found                    