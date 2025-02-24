import { DataGrid } from "@mui/x-data-grid";

const TableDisplay = ({ data }) => {
  // infer columns from first row, assume rows are consistent
  const columns =
    data.table.length === 0
      ? null
      : Object.keys(data.table[0]).map((e) => ({ field: e, flex: 1 }));

  // assign id to each row (required)
  const rows = data.table.map((e, i) => Object.assign({ id: i }, e));

  return <DataGrid density="compact" rows={rows} columns={columns} />;
};

export default TableDisplay;
