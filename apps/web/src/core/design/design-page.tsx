// Catalogue vivant du design system [D29] : chaque composant dans ses etats,
// avec choix du theme et de la teinte d'espace. Page interne (/design).
import { useEffect, useState, type ReactNode } from "react";

import { ActionMenu } from "../../ui/action-menu.tsx";
import { Button, IconButton } from "../../ui/button.tsx";
import {
  Chip,
  RadioGroup,
  SegmentedControl,
  Stepper,
  Switch,
  TintPicker,
} from "../../ui/controls.tsx";
import { Avatar, Badge, EmptyState, Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { OptionList } from "../../ui/option-list.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { ToastProvider } from "../../ui/toast.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { THEME_SWATCHES, THEMES, themeLabel, tintNames, type Theme } from "../../theme/themes.ts";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="fm-stack border-b border-line py-6">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="fm-row">{children}</div>
    </section>
  );
}

function ToastDemo() {
  const toast = useToast();
  return (
    <>
      <Button onClick={() => toast("Espace créé", { tone: "success" })}>Toast succès</Button>
      <Button onClick={() => toast("Connexion perdue", { tone: "danger" })}>Toast erreur</Button>
    </>
  );
}

export function DesignPage({ initialTheme = "braise-dark" }: { initialTheme?: Theme }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [tint, setTint] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.space = String(tint);
  }, [theme, tint]);

  return (
    <ToastProvider>
      <main className="fm-root mx-auto max-w-4xl p-4">
        <h1 className="font-display text-3xl font-bold">Design system</h1>
        <p className="text-ink-muted">
          Composants de Forest Manager dans le thème et la teinte choisis.
        </p>

        <Section title="Thème">
          <RadioGroup
            label="Thème"
            value={theme}
            onChange={setTheme}
            options={THEMES.map((t) => ({
              value: t,
              label: themeLabel(t),
              swatches: THEME_SWATCHES[t],
            }))}
          />
        </Section>

        <Section title="TintPicker">
          <TintPicker
            value={tint}
            onChange={setTint}
            names={tintNames(theme)}
            label="Teinte d'espace"
          />
        </Section>

        <Section title="Button">
          <Button variant="primary" icon="plus">
            Nouvelle recette
          </Button>
          <Button>Annuler</Button>
          <Button variant="ghost">Plus tard</Button>
          <Button variant="danger" icon="trash">
            Supprimer
          </Button>
          <Button size="sm">Petit</Button>
          <Button disabled>Désactivé</Button>
          <IconButton icon="bell" label="Notifications" count={3} />
          <IconButton icon="more" label="Plus d'actions" outline />
        </Section>

        <Section title="Field">
          <div className="fm-stack w-full max-w-sm">
            <Field label="Nom de l'espace" placeholder="Famille" hint="3 caractères minimum" />
            <Field label="Email" defaultValue="lea@exemple" error="Adresse email invalide." />
            <Field label="Description" multiline placeholder="Pour qui est cet espace ?" />
          </div>
        </Section>

        <Section title="Switch">
          <Switch label="Rester connecté" defaultChecked />
          <Switch label="Désactivé" disabled />
        </Section>

        <Section title="Stepper">
          <Stepper label="Portions" defaultValue={4} unit="pers." />
        </Section>

        <Section title="SegmentedControl">
          <SegmentedControl
            label="Inviter par"
            options={[
              { value: "link", label: "Lien" },
              { value: "username", label: "Nom d'utilisateur" },
            ]}
          />
        </Section>

        <Section title="Chip">
          <Chip defaultSelected>Végétarien</Chip>
          <Chip>Rapide</Chip>
        </Section>

        <Section title="RadioGroup">
          <RadioGroup
            label="Durée du lien"
            defaultValue="7"
            options={[
              { value: "1", label: "1 jour" },
              { value: "7", label: "7 jours", hint: "Recommandé" },
              { value: "30", label: "30 jours" },
            ]}
          />
        </Section>

        <Section title="Badge et Avatar">
          <Badge>Neutre</Badge>
          <Badge tone="accent">Nouveau</Badge>
          <Badge tone="second">Composée</Badge>
          <Badge tone="success">Actif</Badge>
          <Badge tone="warning">Bientôt</Badge>
          <Badge tone="danger">Supprimé</Badge>
          <Avatar name="Léa Martin" />
          <Avatar name="Famille" tint={tint} size={40} />
        </Section>

        <Section title="OptionList">
          <div className="w-full max-w-sm">
            <OptionList
              label="Espace"
              defaultValue="family"
              options={[
                {
                  value: "family",
                  label: "Famille",
                  hint: "6 membres",
                  space: { id: "f", name: "Famille", tint: 1 },
                },
                {
                  value: "colloc",
                  label: "Colloc",
                  hint: "3 membres",
                  space: { id: "c", name: "Colloc", tint: 2 },
                },
                {
                  value: "tom",
                  label: "TOM",
                  space: { id: "t", name: "TOM", tint: 3, deleting: { daysLeft: 12 } },
                },
              ]}
            />
          </div>
        </Section>

        <Section title="EmptyState">
          <EmptyState
            title="Aucune recette"
            action={<Button variant="primary">Ajouter une recette</Button>}
          >
            Ajoute ta première recette pour la partager avec l'espace.
          </EmptyState>
        </Section>

        <Section title="Skeleton">
          <div className="w-full max-w-sm">
            <Skeleton kind="row" count={3} />
          </div>
        </Section>

        <Section title="ActionMenu">
          <ActionMenu
            label="Actions du membre"
            trigger={<IconButton icon="more" label="Actions du membre" />}
            items={[
              { id: "promote", label: "Promouvoir modérateur", icon: "shield" },
              "-",
              { id: "exclude", label: "Exclure de l'espace", icon: "user-minus", danger: true },
            ]}
            onSelect={() => undefined}
          />
        </Section>

        <Section title="Sheet">
          <Button
            onClick={() => {
              setSheetOpen(true);
            }}
          >
            Ouvrir une feuille
          </Button>
          <Sheet
            open={sheetOpen}
            onClose={() => {
              setSheetOpen(false);
            }}
            title="Inviter des membres"
          >
            <p>Une feuille monte du bas sur mobile et s'affiche au centre sur grand écran.</p>
            <SheetFooter>
              <Button variant="primary" block>
                Créer le lien
              </Button>
            </SheetFooter>
          </Sheet>
        </Section>

        <Section title="Toast">
          <ToastDemo />
        </Section>
      </main>
    </ToastProvider>
  );
}
