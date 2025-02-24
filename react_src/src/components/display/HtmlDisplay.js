import DOMPurify from "dompurify";

const HtmlDisplay = ({ data }) => {
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: data.html,
      }}
    ></div>
  );
};

export default HtmlDisplay;
