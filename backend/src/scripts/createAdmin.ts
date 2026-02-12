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
import { read } from "read";

const prisma = new PrismaClient();

async function prompt(question: string): Promise<string> {
  const result = await read({ prompt: question });
  return result.trim();
}

async function promptHidden(question: string): Promise<string> {
  const result = await read({ prompt: question, silent: true });
  return result.trim();
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
