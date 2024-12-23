import { Router, Request, Response, NextFunction } from 'express';
import { createModuleLogger } from '../utils/logger.js';
import {
  createProposal,
  getAllProposals,
  getProposalById,
  updateProposal,
  deleteProposal,
  createProposalWallet,
  getAllProposalSnapshots,
  createProposalSnapshot,
  updateProposalSnapshot,
  deleteProposalSnapshot,
  createProposalVote,
  getVotesForProposal,
  createProposalYesVote,
  getAllProposalYesVotes,
  updateProposalYesVote,
  deleteProposalYesVote,
  createProposalNoVote,
  getAllProposalNoVotes,
  updateProposalNoVote,
  deleteProposalNoVote,
  createProposalNomination,
  getAllProposalNominations,
  updateProposalNomination,
  deleteProposalNomination,
  getAllProposalTypes,
  createProposalType,
  updateProposalType,
  deleteProposalType,
  getAllProposalStatuses,
  createProposalStatus,
  updateProposalStatus,
  deleteProposalStatus
} from '../models/proposalModels.js';
import {
  Proposal,
  ProposalVote,
  ProposalYesVote,
  ProposalNoVote,
  ProposalNomination,
  ProposalType,
  ProposalStatus
} from '../types/proposalTypes.js';
import { proposalSubmissionFee } from '../utils/tokenCalcs.js';
import { createKaspaWallet } from '../utils/walletUtils.js';

const logger = createModuleLogger('proposalController');

// Proposals
export const submitProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const proposal: Omit<Proposal, 'id'> = req.body;
    logger.info({ proposal }, 'Submitting new proposal');

    // Generate a new wallet
    const walletDetails = await createKaspaWallet();
    logger.debug({ address: walletDetails.address }, 'Wallet created for proposal');

    // Create a new proposal wallet entry
    const proposalWalletId = await createProposalWallet(walletDetails.address, walletDetails.encryptedPrivateKey);
    logger.debug({ proposalWalletId }, 'Proposal wallet entry created');

    // Add wallet details and defaults to the proposal
    const newProposal = await createProposal({
      ...proposal,
      title: proposal.title,
      description: proposal.description,
      submitted: new Date(),
      reviewed: false,
      approved: false,
      passed: false,
      votesActive: false,
      status: 1,
      wallet: proposalWalletId.id,
    });

    logger.info({ 
      proposalId: newProposal.id,
      walletAddress: walletDetails.address 
    }, 'Proposal created successfully');

    res.status(201).json({
      proposalId: newProposal.id,
      walletAddress: walletDetails.address,
    });
  } catch (error) {
    logger.error({ error }, 'Error submitting proposal');
    next(error);
  }
};

export const fetchAllProposals = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = {
      title: req.query.title as string | undefined,
      status: req.query.status ? parseInt(req.query.status as string, 10) : undefined
    };
    const sort = req.query.sort as string;
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    logger.info({ filters, sort, limit, offset }, 'Fetching proposals');

    const proposals = await getAllProposals(filters, sort, limit, offset);
    logger.debug({ count: proposals.length }, 'Proposals retrieved');

    res.status(200).json(proposals);
  } catch (error) {
    logger.error({ error }, 'Error fetching proposals');
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
};

export const modifyProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const proposalId = parseInt(req.params.proposalId, 10);
    if (isNaN(proposalId)) {
      logger.warn({ proposalId: req.params.proposalId }, 'Invalid proposal ID format');
      res.status(400).json({ error: 'Invalid proposal ID' });
      return;
    }

    logger.info({ proposalId, updates: req.body }, 'Modifying proposal');
    const updatedProposal = await updateProposal(proposalId, req.body);
    
    if (updatedProposal) {
      logger.info({ proposalId }, 'Proposal updated successfully');
      res.status(200).json(updatedProposal);
    } else {
      logger.warn({ proposalId }, 'Proposal not found');
      res.status(404).json({ error: 'Proposal not found' });
    }
  } catch (error) {
    logger.error({ error, proposalId: req.params.proposalId }, 'Error modifying proposal');
    next(error);
  }
};

export const removeProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const proposalId = parseInt(req.params.proposalId, 10);
    if (isNaN(proposalId)) {
      logger.warn({ proposalId: req.params.proposalId }, 'Invalid proposal ID format');
      res.status(400).json({ error: 'Invalid proposal ID' });
      return;
    }

    logger.info({ proposalId }, 'Removing proposal');
    await deleteProposal(proposalId);
    logger.info({ proposalId }, 'Proposal deleted successfully');
    res.status(204).send();
  } catch (error) {
    logger.error({ error, proposalId: req.params.proposalId }, 'Error removing proposal');
    res.status(500).json({ error: 'Failed to delete proposal' });
  }
};

export const fetchProposalById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const proposalId = parseInt(req.params.id, 10);
    if (isNaN(proposalId)) {
      logger.warn({ proposalId: req.params.id }, 'Invalid proposal ID format');
      res.status(400).json({ error: 'Invalid proposal ID' });
      return;
    }

    logger.info({ proposalId }, 'Fetching proposal by ID');
    const proposal = await getProposalById(proposalId);
    
    if (!proposal) {
      logger.warn({ proposalId }, 'Proposal not found');
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    logger.debug({ proposalId }, 'Proposal retrieved successfully');
    res.status(200).json(proposal);
  } catch (error) {
    logger.error({ error, proposalId: req.params.id }, 'Error fetching proposal');
    next(error);
  }
};

// Proposal Votes
export const submitProposalVote = async (req: Request, res: Response): Promise<void> => {
  try {
    const vote: Omit<ProposalVote, 'id'> = req.body;
    logger.info({ vote }, 'Submitting proposal vote');
    
    const newVote = await createProposalVote(vote);
    logger.info({ voteId: newVote.id }, 'Proposal vote submitted successfully');
    res.status(201).json(newVote);
  } catch (error) {
    logger.error({ error, vote: req.body }, 'Error submitting proposal vote');
    res.status(500).json({ error: 'Failed to submit proposal vote' });
  }
};

export const fetchVotesForProposal = async (req: Request, res: Response): Promise<void> => {
  try {
    const proposalId = parseInt(req.params.proposalId, 10);
    if (isNaN(proposalId)) {
      logger.warn({ proposalId: req.params.proposalId }, 'Invalid proposal ID format');
      res.status(400).json({ error: 'Invalid proposal ID' });
      return;
    }

    logger.info({ proposalId }, 'Fetching votes for proposal');
    const votes = await getVotesForProposal(proposalId);
    logger.debug({ proposalId, voteCount: votes.length }, 'Votes retrieved successfully');
    res.status(200).json(votes);
  } catch (error) {
    logger.error({ error, proposalId: req.params.proposalId }, 'Error fetching votes for proposal');
    res.status(500).json({ error: 'Failed to fetch votes for proposal' });
  }
};

// Proposal Yes Votes
export const fetchAllProposalYesVotes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    logger.info('Fetching all proposal yes votes');
    const votes = await getAllProposalYesVotes();
    logger.debug({ voteCount: votes.length }, 'Yes votes retrieved successfully');
    res.status(200).json(votes);
  } catch (error) {
    logger.error({ error }, 'Error fetching proposal yes votes');
    next(error);
  }
};

export const submitProposalYesVote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const vote: Omit<ProposalYesVote, 'id' | 'created'> = req.body;
    logger.info({ vote }, 'Submitting proposal yes vote');
    
    const newVote = await createProposalYesVote(vote);
    logger.info({ voteId: newVote.id }, 'Yes vote submitted successfully');
    res.status(201).json(newVote);
  } catch (error) {
    logger.error({ error, vote: req.body }, 'Error submitting yes vote');
    next(error);
  }
};

export const modifyProposalYesVote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      logger.warn({ voteId: req.params.id }, 'Invalid vote ID format');
      res.status(400).json({ error: 'Invalid vote ID' });
      return;
    }

    const voteData: Partial<ProposalYesVote> = req.body;
    logger.info({ voteId: id, updates: voteData }, 'Modifying yes vote');
    
    const updatedVote = await updateProposalYesVote(id, voteData);
    logger.info({ voteId: id }, 'Yes vote updated successfully');
    res.status(200).json(updatedVote);
  } catch (error) {
    logger.error({ error, voteId: req.params.id }, 'Error modifying yes vote');
    next(error);
  }
};

export const removeProposalYesVote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      logger.warn({ voteId: req.params.id }, 'Invalid vote ID format');
      res.status(400).json({ error: 'Invalid vote ID' });
      return;
    }

    logger.info({ voteId: id }, 'Removing yes vote');
    await deleteProposalYesVote(id);
    logger.info({ voteId: id }, 'Yes vote deleted successfully');
    res.status(204).send();
  } catch (error) {
    logger.error({ error, voteId: req.params.id }, 'Error removing yes vote');
    next(error);
  }
};

// Proposal No Votes
export const fetchAllProposalNoVotes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    logger.info('Fetching all proposal no votes');
    const votes = await getAllProposalNoVotes();
    logger.debug({ voteCount: votes.length }, 'No votes retrieved successfully');
    res.status(200).json(votes);
  } catch (error) {
    logger.error({ error }, 'Error fetching proposal no votes');
    next(error);
  }
};

export const submitProposalNoVote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const vote: Omit<ProposalNoVote, 'id' | 'created'> = req.body;
    logger.info({ vote }, 'Submitting proposal no vote');
    
    const newVote = await createProposalNoVote(vote);
    logger.info({ voteId: newVote.id }, 'No vote submitted successfully');
    res.status(201).json(newVote);
  } catch (error) {
    logger.error({ error, vote: req.body }, 'Error submitting no vote');
    next(error);
  }
};

export const modifyProposalNoVote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      logger.warn({ voteId: req.params.id }, 'Invalid vote ID format');
      res.status(400).json({ error: 'Invalid vote ID' });
      return;
    }

    const voteData: Partial<ProposalNoVote> = req.body;
    logger.info({ voteId: id, updates: voteData }, 'Modifying no vote');
    
    const updatedVote = await updateProposalNoVote(id, voteData);
    logger.info({ voteId: id }, 'No vote updated successfully');
    res.status(200).json(updatedVote);
  } catch (error) {
    logger.error({ error, voteId: req.params.id }, 'Error modifying no vote');
    next(error);
  }
};

export const removeProposalNoVote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      logger.warn({ voteId: req.params.id }, 'Invalid vote ID format');
      res.status(400).json({ error: 'Invalid vote ID' });
      return;
    }

    logger.info({ voteId: id }, 'Removing no vote');
    await deleteProposalNoVote(id);
    logger.info({ voteId: id }, 'No vote deleted successfully');
    res.status(204).send();
  } catch (error) {
    logger.error({ error, voteId: req.params.id }, 'Error removing no vote');
    next(error);
  }
};

// Proposal Nominations
export const fetchAllProposalNominations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    logger.info('Fetching all proposal nominations');
    const nominations = await getAllProposalNominations();
    logger.debug({ nominationCount: nominations.length }, 'Nominations retrieved successfully');
    res.status(200).json(nominations);
  } catch (error) {
    logger.error({ error }, 'Error fetching proposal nominations');
    next(error);
  }
};

export const submitProposalNomination = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const nomination: Omit<ProposalNomination, 'id'> = req.body;
    logger.info({ nomination }, 'Submitting proposal nomination');
    
    const newNomination = await createProposalNomination(nomination);
    logger.info({ nominationId: newNomination.id }, 'Nomination submitted successfully');
    res.status(201).json(newNomination);
  } catch (error) {
    logger.error({ error, nomination: req.body }, 'Error submitting nomination');
    next(error);
  }
};

export const modifyProposalNomination = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      logger.warn({ nominationId: req.params.id }, 'Invalid nomination ID format');
      res.status(400).json({ error: 'Invalid nomination ID' });
      return;
    }

    const nominationData: Partial<ProposalNomination> = req.body;
    logger.info({ nominationId: id, updates: nominationData }, 'Modifying proposal nomination');
    
    const updatedNomination = await updateProposalNomination(id, nominationData);
    logger.info({ nominationId: id }, 'Nomination updated successfully');
    res.status(200).json(updatedNomination);
  } catch (error) {
    logger.error({ error, nominationId: req.params.id }, 'Error modifying nomination');
    next(error);
  }
};

export const removeProposalNomination = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      logger.warn({ nominationId: req.params.id }, 'Invalid nomination ID format');
      res.status(400).json({ error: 'Invalid nomination ID' });
      return;
    }

    logger.info({ nominationId: id }, 'Removing proposal nomination');
    await deleteProposalNomination(id);
    logger.info({ nominationId: id }, 'Nomination deleted successfully');
    res.status(204).send();
  } catch (error) {
    logger.error({ error, nominationId: req.params.id }, 'Error removing nomination');
    next(error);
  }
};

// Proposal Types
export const fetchAllProposalTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    logger.info('Fetching all proposal types');
    const types = await getAllProposalTypes();
    logger.debug({ typeCount: types.length }, 'Proposal types retrieved successfully');
    res.status(200).json(types);
  } catch (error) {
    logger.error({ error }, 'Error fetching proposal types');
    next(error);
  }
};

export const addProposalType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, active } = req.body;
    logger.info({ name, active }, 'Adding proposal type');
    
    const newType = await createProposalType(name, active);
    logger.info({ typeId: newType.id }, 'Proposal type created successfully');
    res.status(201).json(newType);
  } catch (error) {
    logger.error({ error, type: req.body }, 'Error adding proposal type');
    next(error);
  }
};

export const modifyProposalType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      logger.warn({ typeId: req.params.id }, 'Invalid type ID format');
      res.status(400).json({ error: 'Invalid type ID' });
      return;
    }

    const { name, active } = req.body;
    logger.info({ typeId: id, name, active }, 'Modifying proposal type');
    
    const updatedType = await updateProposalType(id, name, active);
    logger.info({ typeId: id }, 'Proposal type updated successfully');
    res.status(200).json(updatedType);
  } catch (error) {
    logger.error({ error, typeId: req.params.id }, 'Error modifying proposal type');
    next(error);
  }
};

export const removeProposalType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      logger.warn({ typeId: req.params.id }, 'Invalid type ID format');
      res.status(400).json({ error: 'Invalid type ID' });
      return;
    }

    logger.info({ typeId: id }, 'Removing proposal type');
    await deleteProposalType(id);
    logger.info({ typeId: id }, 'Proposal type deleted successfully');
    res.status(204).send();
  } catch (error) {
    logger.error({ error, typeId: req.params.id }, 'Error removing proposal type');
    next(error);
  }
};

// Proposal Status
export const fetchAllProposalStatuses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    logger.info('Fetching all proposal statuses');
    const statuses = await getAllProposalStatuses();
    logger.debug({ statusCount: statuses.length }, 'Proposal statuses retrieved successfully');
    res.status(200).json(statuses);
  } catch (error) {
    logger.error({ error }, 'Error fetching proposal statuses');
    next(error);
  }
};

export const addProposalStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, active } = req.body;
    logger.info({ name, active }, 'Adding proposal status');
    
    const newStatus = await createProposalStatus(name, active);
    logger.info({ statusId: newStatus.id }, 'Proposal status created successfully');
    res.status(201).json(newStatus);
  } catch (error) {
    logger.error({ error, status: req.body }, 'Error adding proposal status');
    next(error);
  }
};

export const modifyProposalStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      logger.warn({ statusId: req.params.id }, 'Invalid status ID format');
      res.status(400).json({ error: 'Invalid status ID' });
      return;
    }

    const { name, active } = req.body;
    logger.info({ statusId: id, name, active }, 'Modifying proposal status');
    
    const updatedStatus = await updateProposalStatus(id, name, active);
    logger.info({ statusId: id }, 'Proposal status updated successfully');
    res.status(200).json(updatedStatus);
  } catch (error) {
    logger.error({ error, statusId: req.params.id }, 'Error modifying proposal status');
    next(error);
  }
};

export const removeProposalStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      logger.warn({ statusId: req.params.id }, 'Invalid status ID format');
      res.status(400).json({ error: 'Invalid status ID' });
      return;
    }

    logger.info({ statusId: id }, 'Removing proposal status');
    await deleteProposalStatus(id);
    logger.info({ statusId: id }, 'Proposal status deleted successfully');
    res.status(204).send();
  } catch (error) {
    logger.error({ error, statusId: req.params.id }, 'Error removing proposal status');
    next(error);
  }
};

// Proposal Qualification
export const qualifyProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const proposalId = parseInt(req.params.proposalId, 10);
    if (isNaN(proposalId)) {
      logger.warn({ proposalId: req.params.proposalId }, 'Invalid proposal ID format');
      res.status(400).json({ error: 'Invalid proposal ID' });
      return;
    }

    logger.info({ proposalId, updates: req.body }, 'Qualifying proposal');
    const updatedProposal = await updateProposal(proposalId, req.body);
    if (!updatedProposal) {
      logger.warn({ proposalId }, 'Proposal not found');
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    logger.debug({ proposalId }, 'Fetching proposal with wallet details');
    const proposalWithWallet = await getProposalById(proposalId);
    if (!proposalWithWallet) {
      logger.warn({ proposalId }, 'Proposal not found after update');
      res.status(404).json({ error: 'Proposal not found after update' });
      return;
    }

    logger.debug('Calculating proposal submission fee');
    const fee = await proposalSubmissionFee();

    logger.info({ proposalId, fee, wallet: proposalWithWallet.wallet }, 'Proposal qualified successfully');
    res.status(200).json({
      fee,
      wallet: proposalWithWallet.wallet,
    });
  } catch (error) {
    logger.error({ error, proposalId: req.params.proposalId }, 'Error qualifying proposal');
    next(error);
  }
};

// Proposal Snapshots
export const fetchAllProposalSnapshots = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    logger.info('Fetching all proposal snapshots');
    const snapshots = await getAllProposalSnapshots();
    logger.debug({ snapshotCount: snapshots.length }, 'Snapshots retrieved successfully');
    res.status(200).json(snapshots);
  } catch (error) {
    logger.error({ error }, 'Error fetching proposal snapshots');
    next(error);
  }
};

export const addProposalSnapshot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { proposalId, data } = req.body;
    logger.info({ proposalId }, 'Adding proposal snapshot');
    
    const newSnapshot = await createProposalSnapshot(proposalId, data);
    logger.info({ snapshotId: newSnapshot.id, proposalId }, 'Snapshot created successfully');
    res.status(201).json(newSnapshot);
  } catch (error) {
    logger.error({ error, proposalId: req.body.proposalId }, 'Error adding proposal snapshot');
    next(error);
  }
};

export const modifyProposalSnapshot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      logger.warn({ snapshotId: req.params.id }, 'Invalid snapshot ID format');
      res.status(400).json({ error: 'Invalid snapshot ID' });
      return;
    }

    const { data } = req.body;
    logger.info({ snapshotId: id }, 'Modifying proposal snapshot');
    
    const updatedSnapshot = await updateProposalSnapshot(id, data);
    logger.info({ snapshotId: id }, 'Snapshot updated successfully');
    res.status(200).json(updatedSnapshot);
  } catch (error) {
    logger.error({ error, snapshotId: req.params.id }, 'Error modifying proposal snapshot');
    next(error);
  }
};

export const removeProposalSnapshot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      logger.warn({ snapshotId: req.params.id }, 'Invalid snapshot ID format');
      res.status(400).json({ error: 'Invalid snapshot ID' });
      return;
    }

    logger.info({ snapshotId: id }, 'Removing proposal snapshot');
    await deleteProposalSnapshot(id);
    logger.info({ snapshotId: id }, 'Snapshot deleted successfully');
    res.status(204).send();
  } catch (error) {
    logger.error({ error, snapshotId: req.params.id }, 'Error removing proposal snapshot');
    next(error);
  }
}; 