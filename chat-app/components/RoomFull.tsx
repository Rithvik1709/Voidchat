import RoomNotice from "./RoomNotice";

/** Shown when a room has reached its member limit. */
export default function RoomFull({ limit }: { limit: number | null }) {
  return (
    <RoomNotice
      accent="full."
      body="The host set a member limit and every seat is taken. Ask them to make room, or try again in a moment."
      label={limit ? `${limit} / ${limit} seats taken` : "Room full"}
      title="This room is"
    />
  );
}
