/**
 * CLI Script: Create SuperAdmin
 * Usage: npm run admin:create
 *
 * Cree un AdminUser avec:
 * - Prompt interactif pour username, email, password
 * - Hash bcrypt du password
 * - Generation du secret TOTP (pour 2FA)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { generateSecret } from "otplib";
import * as readline from "readline";

const prisma = new PrismaClient();

function ask(question: string, silent = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    if (silent) {
      // Supprime l'echo des caracteres saisis (mode mot de passe)
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
        if (s === question) process.stdout.write(s);
      };
    }
    rl.question(question, (answer) => {
      if (silent) process.stdout.write("\n");
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function prompt(question: string): Promise<string> {
  return ask(question);
}

async function promptHidden(question: string): Promise<string> {
  return ask(question, true);
}

async function validateEmail(email: string): Promise<boolean> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function validateUsername(username: string): Promise<boolean> {
  return username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);
}

async function validatePassword(password: string): Promise<boolean> {
  return password.length >= 8;
}

async function main() {
  console.log("\n========================================");
  console.log("  Forest Manager - Create SuperAdmin");
  console.log("========================================\n");

  try {
    // Username
    let username = "";
    while (!username) {
      username = await prompt("Username (min 3 chars, alphanumeric): ");
      if (!(await validateUsername(username))) {
        console.log("❌ Username invalide. Min 3 caracteres, alphanumerique uniquement.");
        username = "";
        continue;
      }
      // Verifier unicite
      const existingUsername = await prisma.adminUser.findUnique({ where: { username } });
      if (existingUsername) {
        console.log("❌ Ce username existe deja.");
        username = "";
      }
    }

    // Email
    let email = "";
    while (!email) {
      email = await prompt("Email: ");
      if (!(await validateEmail(email))) {
        console.log("❌ Email invalide.");
        email = "";
        continue;
      }
      // Verifier unicite
      const existingEmail = await prisma.adminUser.findUnique({ where: { email } });
      if (existingEmail) {
        console.log("❌ Cet email existe deja.");
        email = "";
      }
    }

    // Password
    let password = "";
    while (!password) {
      password = await promptHidden("Password (min 8 chars): ");
      if (!(await validatePassword(password))) {
        console.log("❌ Password trop court. Minimum 8 caracteres.");
        password = "";
        continue;
      }
      const confirmPassword = await promptHidden("Confirm password: ");
      if (password !== confirmPassword) {
        console.log("❌ Les passwords ne correspondent pas.");
        password = "";
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate TOTP secret
    const totpSecret = generateSecret();

    // Create AdminUser
    const adminUser = await prisma.adminUser.create({
      data: {
        username,
        email,
        password: hashedPassword,
        totpSecret,
        totpEnabled: false, // Sera active apres premiere connexion
      },
    });

    console.log("\n========================================");
    console.log("  ✅ SuperAdmin cree avec succes!");
    console.log("========================================");
    console.log(`  ID:       ${adminUser.id}`);
    console.log(`  Username: ${adminUser.username}`);
    console.log(`  Email:    ${adminUser.email}`);
    console.log("========================================");
    console.log("\n⚠️  A la premiere connexion, vous devrez configurer le 2FA (TOTP).\n");
  } catch (error) {
    console.error("\n❌ Erreur lors de la creation:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
