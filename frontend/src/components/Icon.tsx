import back from "../assets/icons/back.svg";
import forward from "../assets/icons/forward.svg";
import plus from "../assets/icons/plus.svg";
import trash from "../assets/icons/trash.svg";
import pin from "../assets/icons/pin.svg";
import save from "../assets/icons/save.svg";
import expand from "../assets/icons/expand.svg";
import table from "../assets/icons/table.svg";
import chart from "../assets/icons/chart.svg";
import close from "../assets/icons/close.svg";
import play from "../assets/icons/play.svg";
import pause from "../assets/icons/pause.svg";
import fx from "../assets/icons/fx.svg";
import trail from "../assets/icons/trail.svg";

const ICONS = { back, forward, plus, trash, pin, save, expand, table, chart, close, play, pause, fx, trail };

interface IconProps {
  name: keyof typeof ICONS;
}

export function Icon({ name }: IconProps) {
  return <img className="icon" src={ICONS[name]} alt={name} />;
}
