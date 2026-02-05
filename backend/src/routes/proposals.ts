import express from "express";
import * as ProposalsController from "../controllers/proposals";

const router = express.Router();

// GET /api/proposals/:proposalId - Detail d'une proposition
router.get("/:proposalId", ProposalsController.getProposal);

// POST /api/proposals/:proposalId/accept - Accepter une proposition
router.post("/:proposalId/accept", ProposalsController.acceptProposal);

// POST /api/proposals/:proposalId/reject - Refuser une proposition
router.post("/:proposalId/reject", ProposalsController.rejectProposal);

export default router;
