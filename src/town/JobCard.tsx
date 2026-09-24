import { ArrowUpRight, Clock3, MapPin } from "lucide-react";
import { formatReward, placeOf, type PortTask } from "../lib/port";
import MuseAvatar from "./MuseAvatar";
import { missionState } from "./TownJobs";

type JobCardProps = {
  task: PortTask;
  onOpen: (task: PortTask) => void;
};

export default function JobCard({ task, onOpen }: JobCardProps) {
  return (
    <button className="job-card" onClick={() => onOpen(task)}>
      <header className="job-card__muse">
        <MuseAvatar
          name={task.creator.name}
          url={task.creator.avatarUrl}
          size={46}
          active
          place="jobs"
          mood="hiring"
        />
        <span><strong>{task.creator.name}</strong><small>sent a mission</small></span>
        <i>{missionState(task)}</i>
      </header>
      <h3>{task.title}</h3>
      <div className="job-card__meta">
        <span><MapPin size={14} />{placeOf(task)}</span>
        <span><Clock3 size={14} />{task.duration || "Time not specified"}</span>
      </div>
      <footer>
        <span><small>Reward</small><strong>{formatReward(task)}</strong></span>
        <b>View mission <ArrowUpRight size={16} /></b>
      </footer>
    </button>
  );
}
