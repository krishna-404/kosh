import { accessSharedWorkflow } from "./access_shared.workflow";
import { questionsWaitingWorkflow } from "./questions_waiting.workflow";
import { userCreatedWorkflow } from "./user_created.workflow";

export const novuWorkflows = [userCreatedWorkflow, accessSharedWorkflow, questionsWaitingWorkflow];
