import RoomNotice from "./RoomNotice";

/** Shown when someone opens a room link for a room that has ended or never existed. */
export default function RoomEnded() {
  return (
    <RoomNotice
      accent="gone."
      body={<>The session was ended, or the link was never valid. Rooms don&apos;t come back once they close.</>}
      label="Room closed · 0 bytes kept"
      title="This room is"
    />
  );
}
