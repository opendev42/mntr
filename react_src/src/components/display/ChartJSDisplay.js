import { Chart as ChartJSReact } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";
import { useTheme } from "@mui/material/styles";

Chart.register(...registerables);

const ChartJSDisplay = ({ data }) => {
  const theme = useTheme();
  const textColor = theme.palette.text.primary;
  const gridColor = theme.palette.divider;

  const themeOptions = {
    plugins: {
      legend: { labels: { color: textColor } },
      tooltip: {
        titleColor: theme.palette.common.white,
        bodyColor: theme.palette.common.white,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        borderColor: theme.palette.divider,
        borderWidth: 1,
      },
    },
    scales: {
      x: { ticks: { color: textColor }, grid: { color: gridColor } },
      y: { ticks: { color: textColor }, grid: { color: gridColor } },
    },
  };

  const options = mergeDeep(themeOptions, data.chartjs_options ?? {});

  return (
    <ChartJSReact
      type={data.chartjs_type}
      data={data.chartjs_data}
      options={options}
    />
  );
};

const mergeDeep = (base, override) => {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null &&
      typeof override[key] === "object" &&
      !Array.isArray(override[key]) &&
      typeof base[key] === "object"
    ) {
      result[key] = mergeDeep(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
};

export default ChartJSDisplay;
