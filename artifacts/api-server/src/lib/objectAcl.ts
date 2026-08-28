import type { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";
export interface ObjectAclPolicy { owner: string; visibility: "private"; }

export async function setObjectAclPolicy(file: File, policy: ObjectAclPolicy): Promise<void> {
  await file.setMetadata({ metadata: { [ACL_POLICY_METADATA_KEY]: JSON.stringify(policy) } });
}