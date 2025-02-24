import { Chart as ChartJSReact } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const ChartJSDisplay = ({ data }) => {
  return (
    <ChartJSReact
      type={data.chartjs_type}
      data={data.chartjs_data}
      options={data.chartjs_options}
    />
  );
};

export default ChartJSDisplay;
