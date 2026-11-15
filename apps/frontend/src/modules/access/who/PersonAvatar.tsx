import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import { IconMail } from "@connected-repo/ui-mui/kosh/icons";
import { type MatrixPerson, nameOf } from "./who.utils";

interface PersonAvatarProps {
	person: Pick<MatrixPerson, "key" | "name" | "email" | "pending">;
	size?: "xs" | "sm" | "md" | "lg";
}

/** A person's face — or an envelope for an invite nobody has signed in to yet. */
export const PersonAvatar = ({ person, size = "sm" }: PersonAvatarProps) =>
	person.pending ? (
		<HolderAvatar name={person.email} size={size}>
			<IconMail />
		</HolderAvatar>
	) : (
		<HolderAvatar name={nameOf(person)} colorKey={person.key} size={size} />
	);
