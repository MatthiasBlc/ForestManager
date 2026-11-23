# Revue des ingredients de la prod (2026-11-23, appliquee)

**Resultat en prod** : 0 nouveau, 139 verifies, tous traduits et ranges (fruits et legumes 35, epicerie salee 38, cremerie 29, boucherie 18, conserves 7, epicerie sucree 5, boulangerie, poissonnerie et boissons 2, surgeles 1) ; 13 fusions. Applique par les routes de l'admin (journal d'audit). Lignes de recette corrigees apres les fusions, une revision chacune : Tarte aubergines tomates et parmesan (eau, note "un fond de verre"), One pot pasta (4 gousses ail ; eau, note "ou bouillon de legumes"), Aubergines roties miso miel (ail, note "une tete entiere"), Tarte rustique courgettes et burrata (pignon de pin, note "une poignee"), Buta Miso Donburi (porc hache, note), Pates saumon mascarpone (fromage frais a tartiner, note), Croquettes brocoli cheddar (ligne poivre ajoutee).

Les 152 ingredients de la prod sont au statut NEW (crees par les utilisateurs, surtout a la reprise des recettes) : aucun verifie, aucun traduit, aucun rayon. Les rayons servent a ranger la liste de courses (C9) : a regler avant. Proposition de Claude, validee par le proprietaire au selecteur le 2026-11-23 : D1 fusion puis unite des lignes de recette corrigee ; D2 premier choix, l'alternative va en note de la ligne de recette ; D3 variantes gardees a part, sauf oignon jaune, sucre en poudre et farine T55 fusionnes ; rayons appliques tels quels. Point ouvert pour C9 : une section de liste de courses ne suit qu'un rayon (`aisleId`), alors que les groupes du proprietaire (Alimentaire...) en couvrent plusieurs.

**Complements (2026-11-23, valides au selecteur, appliques par l'admin)** :

- Noms anglais ajoutes : les 16 unites (gram, milliliter, teaspoon, piece, clove, packet, to taste...), les 10 rayons (Produce, Bakery, Butcher, Fishmonger, Dairy, Savory pantry, Baking & sweets, Canned goods, Frozen, Drinks), les 10 tags globaux qui n'en avaient pas (Appetizer, Quick, Gluten-free, Vegan, Vegetarian, Dessert, Breakfast, Starter, Main course, Batch cooking).
- Deux familles de tags globales creees : "Regime" (Diet : Vegetarien, Vegan, Sans gluten) et "Pratique" (Practical : Rapide, Batch cooking, Congelable, Air fryer) ; plus aucun tag global dans "Autres".
- Poids a la piece (38 ingredients, poids moyens) pour additionner pieces et grammes dans la liste de courses : piece (oeuf 55 g, oignon 100, echalote 30, citron 120, avocat 200, tomate 120, courgette 250, aubergine 300, poivron 150, carotte 100, pomme de terre 150, patate douce 250, concombre 300, poireau 200, butternut 1200, potimarron 1000, brocoli 400, chou-fleur 800, chou 1000, fenouil 250, salade 300, artichaut 300, champignon 20, tortilla 40, burrata 125, mozzarella 125, camembert 250, reblochon 450, bouillon de legumes en cube 10), gousse (ail 5), tranche (pain de mie 25, jambon 40), botte (basilic 30, persil 50), boite (lait de coco 400, thon 140, mais 285, tomates concassees 400).

Actions : **V** verifier tel quel ; **R** renommer puis verifier ; **F** fusionner dans un autre (les recettes suivent la cible). Doutes : D1 quantite dans le nom ; D2 alternatives dans le nom ; D3 variante ou meme produit ; D4 ingredient sans recette ; D5 rayon discutable.

Noms des ingredients et des rayons sans accents dans ce fichier (regle des docs) ; ils gardent leurs accents en base.

| Ingredient actuel                                                         | Rec. | Action                  | Nom FR final                | EN                     | Rayon             | Doute |
| ------------------------------------------------------------------------- | ---- | ----------------------- | --------------------------- | ---------------------- | ----------------- | ----- |
| margarine                                                                 | 1    | V                       | margarine                   | margarine              | Cremerie          |       |
| gruyere rape                                                              | 1    | V                       | gruyere rape                | grated gruyere         | Cremerie          | D3    |
| poitrine fumee                                                            | 1    | V                       | poitrine fumee              | smoked pork belly      | Boucherie         |       |
| fond de verre d'eau                                                       | 1    | F -> eau                |                             |                        |                   | D1    |
| herbes de Provence                                                        | 1    | V                       | herbes de Provence          | herbes de Provence     | Epicerie salee    |       |
| eau                                                                       | 1    | V                       | eau                         | water                  | Boissons          | D5    |
| farine de ble T55                                                         | 1    | F -> farine             |                             |                        |                   | D3    |
| fleur de sel                                                              | 1    | V                       | fleur de sel                | fleur de sel           | Epicerie salee    |       |
| poignee de pignons                                                        | 1    | R                       | pignon de pin               | pine nut               | Epicerie salee    | D1    |
| courgettes                                                                | 1    | F -> courgette          |                             |                        |                   |       |
| jus de citron                                                             | 1    | V                       | jus de citron               | lemon juice            | Epicerie salee    |       |
| tortillas                                                                 | 1    | F -> tortilla           |                             |                        |                   |       |
| avocats                                                                   | 1    | R                       | avocat                      | avocado                | Fruits et legumes |       |
| blanc de poulet                                                           | 2    | V                       | blanc de poulet             | chicken breast         | Boucherie         | D3    |
| porc hache (ou chair a saucisse) / equivalent en boulette vege            | 1    | R                       | porc hache                  | minced pork            | Boucherie         | D2    |
| sake de cuisson                                                           | 1    | V                       | sake de cuisson             | cooking sake           | Epicerie salee    |       |
| sucre en poudre                                                           | 1    | F -> sucre              |                             |                        |                   | D3    |
| gingembre                                                                 | 1    | V                       | gingembre                   | ginger                 | Fruits et legumes |       |
| amandes torrefiees                                                        | 1    | R                       | amande torrefiee            | roasted almond         | Epicerie sucree   |       |
| amandes torrefiees (facultatif)                                           | 0    | F -> amandes torrefiees |                             |                        |                   |       |
| parmesan rape                                                             | 2    | V                       | parmesan rape               | grated parmesan        | Cremerie          | D3    |
| piment                                                                    | 1    | V                       | piment                      | chili pepper           | Fruits et legumes |       |
| gousses d'ail                                                             | 1    | F -> ail                |                             |                        |                   | D1    |
| tomates cerise (idealement multicolores)                                  | 1    | F -> tomate cerise      |                             |                        |                   |       |
| eau ou de bouillon de legumes                                             | 1    | F -> eau                |                             |                        |                   | D2    |
| huile                                                                     | 1    | V                       | huile                       | oil                    | Epicerie salee    |       |
| ail                                                                       | 2    | V                       | ail                         | garlic                 | Fruits et legumes |       |
| thym                                                                      | 1    | V                       | thym                        | thyme                  | Fruits et legumes |       |
| mozzarella rapee                                                          | 1    | V                       | mozzarella rapee            | grated mozzarella      | Cremerie          | D3    |
| puree de tomates concassees                                               | 1    | R                       | tomates concassees          | crushed tomatoes       | Conserves         |       |
| mascarpone                                                                | 1    | V                       | mascarpone                  | mascarpone             | Cremerie          |       |
| aubergines                                                                | 2    | F -> aubergine          |                             |                        |                   |       |
| saumon Fume                                                               | 1    | R                       | saumon fume                 | smoked salmon          | Poissonnerie      |       |
| fromage en Creme Philadelphia (ou Fromage Frais ou Mascarpone ou Ricotta) | 1    | R                       | fromage frais a tartiner    | cream cheese           | Cremerie          | D2    |
| capres                                                                    | 1    | R                       | capre                       | caper                  | Conserves         |       |
| citron                                                                    | 1    | V                       | citron                      | lemon                  | Fruits et legumes |       |
| persil                                                                    | 1    | V                       | persil                      | parsley                | Fruits et legumes |       |
| huile d'Olive                                                             | 4    | R                       | huile d'olive               | olive oil              | Epicerie salee    |       |
| oignon Jaune                                                              | 1    | F -> oignon             |                             |                        |                   | D3    |
| gros Sel                                                                  | 1    | R                       | gros sel                    | coarse salt            | Epicerie salee    |       |
| penne Rigate                                                              | 1    | R                       | penne rigate                | penne rigate           | Epicerie salee    |       |
| sel et poivre                                                             | 1    | F -> sel                |                             |                        |                   | D2    |
| cheddar rape                                                              | 2    | V                       | cheddar rape                | grated cheddar         | Cremerie          | D3    |
| sel                                                                       | 4    | V                       | sel                         | salt                   | Epicerie salee    |       |
| poivre                                                                    | 4    | V                       | poivre                      | pepper                 | Epicerie salee    |       |
| vinaigre balsamique blanc                                                 | 1    | V                       | vinaigre balsamique blanc   | white balsamic vinegar | Epicerie salee    |       |
| miel                                                                      | 1    | V                       | miel                        | honey                  | Epicerie sucree   |       |
| huile de tournesol                                                        | 2    | V                       | huile de tournesol          | sunflower oil          | Epicerie salee    |       |
| bouillon cube legumes                                                     | 1    | R                       | bouillon de legumes en cube | vegetable stock cube   | Epicerie salee    |       |
| noix de cajou concassees                                                  | 1    | R                       | noix de cajou               | cashew nut             | Epicerie salee    |       |
| graines de sesame                                                         | 1    | R                       | graine de sesame            | sesame seed            | Epicerie salee    |       |
| sauce soja                                                                | 2    | V                       | sauce soja                  | soy sauce              | Epicerie salee    |       |
| miso blanc                                                                | 2    | V                       | miso blanc                  | white miso             | Epicerie salee    |       |
| huile de sesame                                                           | 2    | V                       | huile de sesame             | sesame oil             | Epicerie salee    |       |
| oignon nouveau                                                            | 1    | V                       | oignon nouveau              | spring onion           | Fruits et legumes |       |
| tete d'ail                                                                | 1    | F -> ail                |                             |                        |                   | D1    |
| echalote                                                                  | 1    | V                       | echalote                    | shallot                | Fruits et legumes |       |
| pousse d'epinard                                                          | 1    | V                       | pousse d'epinard            | baby spinach           | Fruits et legumes | D3    |
| tomate cerise                                                             | 1    | V                       | tomate cerise               | cherry tomato          | Fruits et legumes |       |
| brocoli                                                                   | 1    | V                       | brocoli                     | broccoli               | Fruits et legumes |       |
| bechamel                                                                  | 0    | V                       | bechamel                    | bechamel sauce         | Cremerie          | D4    |
| saucisse de Toulouse                                                      | 0    | V                       | saucisse de Toulouse        | Toulouse sausage       | Boucherie         |       |
| pecorino                                                                  | 1    | V                       | pecorino                    | pecorino               | Cremerie          |       |
| cidre                                                                     | 1    | V                       | cidre                       | cider                  | Boissons          |       |
| porc                                                                      | 2    | V                       | porc                        | pork                   | Boucherie         |       |
| nouilles                                                                  | 0    | R                       | nouille                     | noodle                 | Epicerie salee    |       |
| magret de canard                                                          | 0    | V                       | magret de canard            | duck breast            | Boucherie         |       |
| chocolat                                                                  | 1    | V                       | chocolat                    | chocolate              | Epicerie sucree   |       |
| chapelure                                                                 | 2    | V                       | chapelure                   | breadcrumbs            | Epicerie salee    |       |
| sucre                                                                     | 3    | V                       | sucre                       | sugar                  | Epicerie sucree   |       |
| beurre                                                                    | 4    | V                       | beurre                      | butter                 | Cremerie          |       |
| fromage blanc                                                             | 0    | V                       | fromage blanc               | fromage blanc          | Cremerie          |       |
| courge spaghetti                                                          | 1    | V                       | courge spaghetti            | spaghetti squash       | Fruits et legumes |       |
| canard                                                                    | 2    | V                       | canard                      | duck                   | Boucherie         |       |
| mimolette                                                                 | 0    | V                       | mimolette                   | mimolette              | Cremerie          |       |
| semoule                                                                   | 0    | V                       | semoule                     | semolina               | Epicerie salee    |       |
| asperge                                                                   | 1    | V                       | asperge                     | asparagus              | Fruits et legumes |       |
| chou                                                                      | 1    | V                       | chou                        | cabbage                | Fruits et legumes |       |
| camembert                                                                 | 1    | V                       | camembert                   | camembert              | Cremerie          |       |
| poireau                                                                   | 3    | V                       | poireau                     | leek                   | Fruits et legumes |       |
| jarret de veau                                                            | 1    | V                       | jarret de veau              | veal shank             | Boucherie         |       |
| macaroni                                                                  | 2    | V                       | macaroni                    | macaroni               | Epicerie salee    |       |
| haricot                                                                   | 1    | V                       | haricot                     | bean                   | Fruits et legumes | D5    |
| crozets                                                                   | 1    | V                       | crozets                     | crozets                | Epicerie salee    |       |
| cordon bleu                                                               | 0    | V                       | cordon bleu                 | cordon bleu            | Surgeles          | D5    |
| pesto                                                                     | 1    | V                       | pesto                       | pesto                  | Epicerie salee    |       |
| buf                                                                       | 1    | V                       | buf                         | beef                   | Boucherie         |       |
| ravioles                                                                  | 1    | V                       | ravioles                    | ravioles               | Cremerie          | D5    |
| paprika                                                                   | 1    | V                       | paprika                     | paprika                | Epicerie salee    |       |
| pate de curry vert                                                        | 1    | V                       | pate de curry vert          | green curry paste      | Epicerie salee    |       |
| choucroute                                                                | 1    | V                       | choucroute                  | sauerkraut             | Boucherie         | D5    |
| houmous                                                                   | 1    | V                       | houmous                     | hummus                 | Cremerie          |       |
| guacamole                                                                 | 2    | V                       | guacamole                   | guacamole              | Cremerie          |       |
| parmesan                                                                  | 3    | V                       | parmesan                    | parmesan               | Cremerie          |       |
| champignon                                                                | 2    | V                       | champignon                  | mushroom               | Fruits et legumes |       |
| carotte                                                                   | 3    | V                       | carotte                     | carrot                 | Fruits et legumes |       |
| chevre                                                                    | 4    | V                       | chevre                      | goat cheese            | Cremerie          |       |
| artichaut                                                                 | 1    | V                       | artichaut                   | artichoke              | Fruits et legumes | D5    |
| mayonnaise                                                                | 2    | V                       | mayonnaise                  | mayonnaise             | Epicerie salee    |       |
| cur de palmier                                                            | 1    | V                       | cur de palmier              | heart of palm          | Conserves         |       |
| salade                                                                    | 2    | V                       | salade                      | lettuce                | Fruits et legumes |       |
| gesier                                                                    | 1    | V                       | gesier                      | gizzard                | Boucherie         | D5    |
| fenouil                                                                   | 1    | V                       | fenouil                     | fennel                 | Fruits et legumes |       |
| curry                                                                     | 1    | V                       | curry                       | curry powder           | Epicerie salee    |       |
| dinde                                                                     | 1    | V                       | dinde                       | turkey                 | Boucherie         |       |
| lait                                                                      | 2    | V                       | lait                        | milk                   | Cremerie          |       |
| farine                                                                    | 4    | V                       | farine                      | flour                  | Epicerie sucree   |       |
| scamorza                                                                  | 1    | V                       | scamorza                    | scamorza               | Cremerie          |       |
| pain                                                                      | 3    | V                       | pain                        | bread                  | Boulangerie       |       |
| fromage a raclette                                                        | 2    | V                       | fromage a raclette          | raclette cheese        | Cremerie          |       |
| fromage                                                                   | 5    | V                       | fromage                     | cheese                 | Cremerie          |       |
| jambon                                                                    | 3    | V                       | jambon                      | ham                    | Boucherie         |       |
| pain de mie                                                               | 1    | V                       | pain de mie                 | sandwich bread         | Boulangerie       |       |
| saucisse                                                                  | 6    | V                       | saucisse                    | sausage                | Boucherie         |       |
| pois casse                                                                | 1    | V                       | pois casse                  | split pea              | Epicerie salee    |       |
| chou-fleur                                                                | 1    | V                       | chou-fleur                  | cauliflower            | Fruits et legumes |       |
| butternut                                                                 | 3    | V                       | butternut                   | butternut squash       | Fruits et legumes |       |
| vache qui rit                                                             | 1    | V                       | vache qui rit               | La Vache qui rit       | Cremerie          |       |
| riz a risotto                                                             | 2    | V                       | riz a risotto               | risotto rice           | Epicerie salee    |       |
| tortilla                                                                  | 2    | V                       | tortilla                    | tortilla               | Epicerie salee    |       |
| olive                                                                     | 2    | V                       | olive                       | olive                  | Conserves         |       |
| aubergine                                                                 | 3    | V                       | aubergine                   | eggplant               | Fruits et legumes |       |
| burrata                                                                   | 1    | V                       | burrata                     | burrata                | Cremerie          |       |
| bacon                                                                     | 1    | V                       | bacon                       | bacon                  | Boucherie         |       |
| lardon                                                                    | 2    | V                       | lardon                      | lardon                 | Boucherie         |       |
| reblochon                                                                 | 1    | V                       | reblochon                   | reblochon              | Cremerie          |       |
| pomme de terre                                                            | 11   | V                       | pomme de terre              | potato                 | Fruits et legumes |       |
| patate douce                                                              | 3    | V                       | patate douce                | sweet potato           | Fruits et legumes |       |
| lentille                                                                  | 2    | V                       | lentille                    | lentil                 | Epicerie salee    |       |
| epinard                                                                   | 4    | V                       | epinard                     | spinach                | Fruits et legumes |       |
| sauce teriyaki                                                            | 2    | V                       | sauce teriyaki              | teriyaki sauce         | Epicerie salee    |       |
| saumon                                                                    | 3    | V                       | saumon                      | salmon                 | Poissonnerie      |       |
| courgette                                                                 | 8    | V                       | courgette                   | zucchini               | Fruits et legumes |       |
| feuille de lasagne                                                        | 2    | V                       | feuille de lasagne          | lasagna sheet          | Epicerie salee    |       |
| marron                                                                    | 1    | V                       | marron                      | chestnut               | Conserves         | D5    |
| potimarron                                                                | 1    | V                       | potimarron                  | red kuri squash        | Fruits et legumes |       |
| uf                                                                        | 14   | V                       | uf                          | egg                    | Cremerie          |       |
| mais                                                                      | 4    | V                       | mais                        | corn                   | Conserves         |       |
| thon                                                                      | 3    | V                       | thon                        | tuna                   | Conserves         | D5    |
| riz                                                                       | 6    | V                       | riz                         | rice                   | Epicerie salee    |       |
| chorizo                                                                   | 3    | V                       | chorizo                     | chorizo                | Boucherie         |       |
| poivron                                                                   | 7    | V                       | poivron                     | bell pepper            | Fruits et legumes |       |
| gnocchis                                                                  | 2    | R                       | gnocchi                     | gnocchi                | Cremerie          |       |
| feta                                                                      | 4    | V                       | feta                        | feta                   | Cremerie          |       |
| oignon                                                                    | 2    | V                       | oignon                      | onion                  | Fruits et legumes |       |
| concombre                                                                 | 5    | V                       | concombre                   | cucumber               | Fruits et legumes |       |
| lait de coco                                                              | 2    | V                       | lait de coco                | coconut milk           | Epicerie salee    |       |
| poulet                                                                    | 9    | V                       | poulet                      | chicken                | Boucherie         |       |
| mozzarella                                                                | 4    | V                       | mozzarella                  | mozzarella             | Cremerie          |       |
| basilic                                                                   | 4    | V                       | basilic                     | basil                  | Fruits et legumes |       |
| pates                                                                     | 6    | V                       | pates                       | pasta                  | Epicerie salee    |       |
| tomate                                                                    | 13   | V                       | tomate                      | tomato                 | Fruits et legumes |       |
