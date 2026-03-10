import DOMPurify from "dompurify";

const HtmlDisplay = ({ data }) => {
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(data.html),
      }}
    ></div>
  );
};

export default HtmlDisplay;
