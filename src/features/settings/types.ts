export interface MyCommitteeLeave {
  isCommitteeMember: boolean;
  committeeId?: string;
  position?: string;
  group?: string | null;
  availability?: string;
  leaveFrom?: string | null;
  leaveTo?: string | null;
  notes?: string | null;
}
