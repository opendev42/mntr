import React from "react";
import { useDispatch } from "react-redux";
import AddchartIcon from "@mui/icons-material/Addchart";
import AppBarButton from "./AppBarButton";
import { addPanel } from "../../state/panelSlice";

const AddPanel = () => {
  const dispatch = useDispatch();
  const onClick = () => {
    dispatch(addPanel());
  };

  return (
    <AppBarButton title="Add panel" icon={<AddchartIcon />} onClick={onClick} />
  );
};

export default AddPanel;
